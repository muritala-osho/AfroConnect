/**
 * Server-side pose validator using face-api.js + sharp.
 * No canvas needed — images are decoded via sharp into raw pixel buffers,
 * then fed directly as tf.Tensor3D to face-api.
 *
 * face-api.node.js normally requires @tensorflow/tfjs-node (native/compiled).
 * We redirect that require to the pure-CPU @tensorflow/tfjs so no native build
 * is needed.  The redirect must run before face-api is first required.
 */
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

const path = require('path');
const sharp = require('sharp');

let faceapi = null;
let tf = null;
let modelsLoaded = false;
let loading = false;

const MODELS_PATH = path.join(__dirname, '..', 'faceModels');

// Poses that can be auto-validated from face landmarks
const FACE_DETECTABLE_POSES = new Set([
  'tilt_left', 'tilt_right', 'smile_wide', 'look_left', 'look_right'
]);

// --- Geometry helpers -------------------------------------------------------

function mean(points) {
  const x = points.reduce((s, p) => s + p.x, 0) / points.length;
  const y = points.reduce((s, p) => s + p.y, 0) / points.length;
  return { x, y };
}

/**
 * Head roll angle in degrees (positive = tilted right, negative = tilted left)
 * Computed from the line between left-eye centre and right-eye centre.
 */
function calcRollDeg(landmarks) {
  const pts = landmarks.positions;
  const leftEye  = mean(pts.slice(36, 42));
  const rightEye = mean(pts.slice(42, 48));
  return Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);
}

/**
 * Normalised yaw: nose-tip offset from face-centre, divided by face-width.
 * Positive = looking right, negative = looking left.
 */
function calcYawNorm(landmarks) {
  const pts = landmarks.positions;
  const noseTip   = pts[30];
  const faceLeft  = pts[0];
  const faceRight = pts[16];
  const faceW     = faceRight.x - faceLeft.x;
  const centreX   = (faceLeft.x + faceRight.x) / 2;
  return faceW > 0 ? (noseTip.x - centreX) / faceW : 0;
}

/**
 * Smile score: how much the mouth corners are raised relative to lip midline.
 * Positive = smiling.
 */
function calcSmileScore(landmarks) {
  const pts = landmarks.positions;
  const leftCorner  = pts[48];
  const rightCorner = pts[54];
  const upperLip    = pts[51];
  const lowerLip    = pts[57];
  const faceLeft    = pts[0];
  const faceRight   = pts[16];
  const faceH       = pts[8].y - pts[19].y; // chin to brow

  const lipMidY     = (upperLip.y + lowerLip.y) / 2;
  const cornerMidY  = (leftCorner.y + rightCorner.y) / 2;
  return faceH > 0 ? (lipMidY - cornerMidY) / faceH : 0;
}

// --- Pose matcher -----------------------------------------------------------

const THRESHOLDS = {
  tilt_left:   { roll: -15 },   // degrees
  tilt_right:  { roll:  15 },
  look_left:   { yaw:  -0.07 },
  look_right:  { yaw:   0.07 },
  smile_wide:  { smile: 0.018 },
};

function matchPose(poseId, landmarks) {
  const roll  = calcRollDeg(landmarks);
  const yaw   = calcYawNorm(landmarks);
  const smile = calcSmileScore(landmarks);

  const details = { rollDeg: roll.toFixed(1), yawNorm: yaw.toFixed(3), smileScore: smile.toFixed(3) };

  let matched = false;
  let reason  = '';

  if (poseId === 'tilt_left') {
    matched = roll < THRESHOLDS.tilt_left.roll;
    reason  = matched ? '' : `Head not tilted enough to the left (detected ${roll.toFixed(0)}°, need < ${THRESHOLDS.tilt_left.roll}°)`;
  } else if (poseId === 'tilt_right') {
    matched = roll > THRESHOLDS.tilt_right.roll;
    reason  = matched ? '' : `Head not tilted enough to the right (detected ${roll.toFixed(0)}°, need > ${THRESHOLDS.tilt_right.roll}°)`;
  } else if (poseId === 'look_left') {
    matched = yaw < THRESHOLDS.look_left.yaw;
    reason  = matched ? '' : 'Not looking far enough to the left';
  } else if (poseId === 'look_right') {
    matched = yaw > THRESHOLDS.look_right.yaw;
    reason  = matched ? '' : 'Not looking far enough to the right';
  } else if (poseId === 'smile_wide') {
    matched = smile > THRESHOLDS.smile_wide.smile;
    reason  = matched ? '' : 'No wide smile detected — show your teeth!';
  } else {
    // Hand poses (thumbs_up, wave, peace, ears_both, chin_touch) cannot be
    // auto-detected from face landmarks. We just confirm a clear face is visible.
    matched = true;
    reason  = 'face-only validation (pose verified by admin)';
  }

  return { matched, reason, details };
}

// --- Public API -------------------------------------------------------------

async function loadModels() {
  if (modelsLoaded) return true;
  if (loading) {
    // Wait for in-progress load
    while (loading) await new Promise(r => setTimeout(r, 200));
    return modelsLoaded;
  }
  loading = true;
  try {
    faceapi = require('@vladmandic/face-api/dist/face-api.node.js');
    tf      = faceapi.tf || require('@tensorflow/tfjs'); // CPU-backend tfjs

    await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_PATH);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_PATH);
    modelsLoaded = true;
    console.log('[PoseValidator] Face models loaded');
  } catch (err) {
    console.error('[PoseValidator] Failed to load models:', err.message);
    modelsLoaded = false;
  } finally {
    loading = false;
  }
  return modelsLoaded;
}

/**
 * Validate a pose from an image buffer (jpeg/png).
 * @param {Buffer} imageBuffer
 * @param {string} poseId
 * @returns {Promise<{matched, noFace, reason, details}>}
 */
async function validatePoseFromBuffer(imageBuffer, poseId) {
  const ready = await loadModels();
  if (!ready) {
    // Models didn't load — fall back gracefully (admin still reviews manually)
    return { matched: true, noFace: false, reason: 'AI models unavailable — admin will review', details: {} };
  }

  // Decode image to raw RGB pixels via sharp (no canvas needed)
  const { data, info } = await sharp(imageBuffer)
    .resize({ width: 320, withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Build a tf.Tensor3D  [H, W, 3]
  const tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3]);

  let detection = null;
  try {
    const opts = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 });
    detection = await faceapi
      .detectSingleFace(tensor, opts)
      .withFaceLandmarks();
  } finally {
    tensor.dispose();
  }

  if (!detection) {
    return {
      matched: false,
      noFace: true,
      reason: 'No face detected. Make sure your face is fully visible, well-lit, and centred.',
      details: {},
    };
  }

  const result = matchPose(poseId, detection.landmarks);
  return { ...result, noFace: false };
}

module.exports = { validatePoseFromBuffer, loadModels, FACE_DETECTABLE_POSES };
