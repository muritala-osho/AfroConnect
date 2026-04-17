/**
 * faceVerifier.js
 * ---------------
 * Backend face verification & liveness utility.
 * Uses @vladmandic/face-api + sharp (no canvas, no native TF build required).
 *
 * Architecture is modular — swap in FaceTec or any other provider by replacing
 * the `compareFaces` export while keeping the same interface.
 */

// Redirect @tensorflow/tfjs-node → pure-CPU @tensorflow/tfjs so no native
// compile is needed (same patch as poseValidator).
(function patchTfjsNode() {
  const Module = require('module');
  const orig = Module._resolveFilename.bind(Module);
  Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === '@tensorflow/tfjs-node') {
      return orig('@tensorflow/tfjs', parent, isMain, options);
    }
    return orig(request, parent, isMain, options);
  };
})();

const path  = require('path');
const sharp = require('sharp');
const https = require('https');
const http  = require('http');
const { URL } = require('url');

const MODELS_PATH = path.join(__dirname, '..', 'faceModels');

// ─── Similarity configuration ───────────────────────────────────────────────
// face-api euclidean distance scale:
//   0.00 – 0.35  →  very strong match (same photo / near-identical)
//   0.35 – 0.55  →  likely same person (good lighting, different angles)
//   0.55+        →  likely different person
//
// We map distance → similarity (0–1) linearly over [0, MAX_DIST].
// Caller's threshold (≥ 0.85) then filters verified users.
const MAX_DIST = 0.60; // distance at which similarity = 0

// ─── Module-level singletons ─────────────────────────────────────────────────
let faceapi       = null;
let tf            = null;
let modelsLoaded  = false;
let loadingPromise = null;

// ─── Model loader ─────────────────────────────────────────────────────────────
async function loadModels() {
  if (modelsLoaded) return true;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      faceapi = require('@vladmandic/face-api/dist/face-api.node.js');
      tf      = faceapi.tf || require('@tensorflow/tfjs');

      await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_PATH);
      await faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_PATH);
      await faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_PATH);

      modelsLoaded = true;
      console.log('[FaceVerifier] Models loaded successfully');
      return true;
    } catch (err) {
      console.error('[FaceVerifier] Failed to load models:', err.message);
      modelsLoaded = false;
      return false;
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

// ─── Image helpers ────────────────────────────────────────────────────────────

/**
 * Fetch a remote image and return its raw Buffer.
 */
function fetchImageBuffer(imageUrl) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(imageUrl);
    const client  = parsed.protocol === 'https:' ? https : http;
    const options = { hostname: parsed.hostname, path: parsed.pathname + parsed.search, timeout: 15000 };

    const req = client.get(options, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`HTTP ${res.statusCode} fetching profile photo`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end',  () => resolve(Buffer.concat(chunks)));
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout fetching profile photo')); });
    req.on('error',   reject);
  });
}

/**
 * Resize + normalise an image buffer to [H, W, 3] tf.Tensor3D.
 * Returns { tensor, width, height }.
 */
async function bufferToTensor(imageBuffer, maxDim = 320) {
  const { data, info } = await sharp(imageBuffer)
    .resize({ width: maxDim, height: maxDim, fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3]);
  return { tensor, width: info.width, height: info.height };
}

// ─── Liveness checks ──────────────────────────────────────────────────────────

/**
 * Basic liveness / anti-spoof heuristics:
 *  1. Face must be detected with reasonable confidence.
 *  2. Face bounding box must occupy a sensible area of the image (not a tiny
 *     face in a distant photo, nor a face filling almost the entire frame
 *     which could indicate a photo-of-photo).
 *  3. Basic landmark variance — a printed/screen photo often has all
 *     landmark points slightly more uniform than a real 3-D face.
 *
 * These are lightweight checks; the frontend liveness actions (blink, smile,
 * head-turn) provide the primary anti-spoof layer.
 */
function runLivenessChecks(detection, imgWidth, imgHeight) {
  const issues = [];

  if (!detection) {
    return { passed: false, issues: ['No face detected in the live selfie'] };
  }

  const { score } = detection.detection;
  if (score < 0.45) {
    issues.push(`Face confidence too low (${(score * 100).toFixed(0)}%)`);
  }

  const box     = detection.detection.box;
  const faceArea  = (box.width * box.height) / (imgWidth * imgHeight);

  if (faceArea < 0.04) {
    issues.push('Face is too small — please move closer to the camera');
  }
  if (faceArea > 0.90) {
    issues.push('Face fills the entire frame — possible photo-of-photo detected');
  }

  // Landmark spread check (real 3-D faces have higher variance)
  const pts = detection.landmarks.positions;
  const xs  = pts.map((p) => p.x);
  const ys  = pts.map((p) => p.y);
  const xRange = Math.max(...xs) - Math.min(...xs);
  const yRange = Math.max(...ys) - Math.min(...ys);

  if (xRange < 20 || yRange < 20) {
    issues.push('Facial landmarks collapsed — spoof or extreme lighting suspected');
  }

  return { passed: issues.length === 0, issues };
}

// ─── Distance → similarity mapping ───────────────────────────────────────────

function distanceToSimilarity(distance) {
  return parseFloat(Math.max(0, Math.min(1, 1 - distance / MAX_DIST)).toFixed(4));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compare a live selfie buffer against a stored profile photo URL.
 *
 * @param {Buffer}  selfieBuffer   - Raw image bytes from the uploaded selfie
 * @param {string}  profilePhotoUrl - Cloudinary (or other CDN) URL
 * @param {number}  [verifyThreshold=0.85] - Minimum similarity to mark verified
 *
 * @returns {Promise<{
 *   verified: boolean,
 *   similarity: number,        // 0–1
 *   liveness: { passed: boolean, issues: string[] },
 *   error?: string
 * }>}
 */
async function compareFaces(selfieBuffer, profilePhotoUrl, verifyThreshold = 0.85) {
  const ready = await loadModels();

  if (!ready) {
    return {
      verified:   false,
      similarity: 0,
      liveness:   { passed: false, issues: ['AI models unavailable'] },
      error:      'Face recognition models could not be loaded',
    };
  }

  let selfieTensor  = null;
  let profileTensor = null;

  try {
    // ── Optimise & decode images ──────────────────────────────────────────
    const { tensor: st, width: sw, height: sh } = await bufferToTensor(selfieBuffer, 320);
    selfieTensor = st;

    const profileBuffer = await fetchImageBuffer(profilePhotoUrl);
    const { tensor: pt } = await bufferToTensor(profileBuffer, 320);
    profileTensor = pt;

    const opts = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 });

    // ── Detect faces (parallel) ───────────────────────────────────────────
    const [selfieDetection, profileDetection] = await Promise.all([
      faceapi.detectSingleFace(selfieTensor, opts).withFaceLandmarks().withFaceDescriptor(),
      faceapi.detectSingleFace(profileTensor, opts).withFaceLandmarks().withFaceDescriptor(),
    ]);

    // ── Liveness validation ───────────────────────────────────────────────
    const liveness = runLivenessChecks(selfieDetection, sw, sh);

    if (!selfieDetection) {
      return {
        verified:   false,
        similarity: 0,
        liveness,
        error: 'No face detected in the selfie. Ensure good lighting and a clear frontal view.',
      };
    }

    if (!profileDetection) {
      return {
        verified:   false,
        similarity: 0,
        liveness,
        error: 'No face detected in the profile photo.',
      };
    }

    // ── Face comparison ───────────────────────────────────────────────────
    const distance   = faceapi.euclideanDistance(selfieDetection.descriptor, profileDetection.descriptor);
    const similarity = distanceToSimilarity(distance);
    const verified   = liveness.passed && similarity >= verifyThreshold;

    return { verified, similarity, distance: parseFloat(distance.toFixed(4)), liveness };
  } finally {
    selfieTensor?.dispose();
    profileTensor?.dispose();
  }
}

/**
 * analyzePose — lightweight frame analysis for liveness HUD.
 *
 * Uses 68-point landmarks to estimate head yaw angle and smile intensity
 * without a network call to an external service.
 *
 * yawAngle convention (mirrors expo-face-detector / MLKit):
 *   negative = user looking to THEIR left  (nose drifts left in image coords)
 *   positive = user looking to THEIR right (nose drifts right in image coords)
 *   NOTE: for a front-facing camera the image is mirrored, so "left in image" = user's left.
 *
 * smileScore: 0-1, where > 0.60 is a clear smile.
 *
 * @param {Buffer} imageBuffer — raw JPEG/PNG bytes
 * @returns {{ faceDetected: boolean, yawAngle: number, smileScore: number }}
 */
async function analyzePose(imageBuffer) {
  const ok = await loadModels();
  if (!ok) return { faceDetected: false, yawAngle: 0, smileScore: 0 };

  let tensor = null;
  try {
    const img = await bufferToTensor(imageBuffer, 320);
    tensor     = img.tensor;

    const detection = await faceapi
      .detectSingleFace(tensor, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.40 }))
      .withFaceLandmarks();

    if (!detection) return { faceDetected: false, yawAngle: 0, smileScore: 0 };

    // ── Extract 68 landmark positions ─────────────────────────────────────
    const pts = detection.landmarks.positions; // array of { x, y }

    // Face width anchors: landmark 0 (left contour) and 16 (right contour)
    const leftX  = pts[0].x;
    const rightX = pts[16].x;
    const faceW  = rightX - leftX; // pixels
    if (faceW < 10) return { faceDetected: false, yawAngle: 0, smileScore: 0 };

    const centerX = (leftX + rightX) / 2;

    // Nose tip: landmark 30
    const noseTipX   = pts[30].x;
    // Relative nose position: 0 = centred, positive = nose right of centre
    const relNose    = (noseTipX - centerX) / faceW; // [-0.5 … +0.5]
    // Scale to degrees.  A fully side-facing head ~ 0.35 offset → ~35°
    const yawAngle   = relNose * 90;   // rough degrees

    // ── Smile score from mouth width ───────────────────────────────────────
    // Landmarks 48 (left mouth corner) and 54 (right mouth corner)
    const mouthLeft  = pts[48];
    const mouthRight = pts[54];
    const mouthW     = Math.sqrt(
      Math.pow(mouthRight.x - mouthLeft.x, 2) +
      Math.pow(mouthRight.y - mouthLeft.y, 2)
    );
    // At rest ~ 0.28–0.32; smiling ~ 0.40+
    const smileRatio = mouthW / faceW;
    // Map [0.28, 0.50] → [0, 1]
    const smileScore = Math.max(0, Math.min(1, (smileRatio - 0.28) / 0.22));

    return { faceDetected: true, yawAngle, smileScore };
  } catch (err) {
    console.warn('[analyzePose] Error:', err.message);
    return { faceDetected: false, yawAngle: 0, smileScore: 0 };
  } finally {
    tensor?.dispose?.();
  }
}

module.exports = { compareFaces, loadModels, analyzePose };
