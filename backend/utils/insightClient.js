/**
 * insightClient.js
 * ----------------
 * Thin Node.js HTTP client for the InsightFace Python microservice.
 *
 * The service runs on INSIGHTFACE_PORT (default 5050) and exposes:
 *   POST /antispoofing  – passive liveness check
 *   POST /compare       – ArcFace face similarity
 *   GET  /health        – readiness probe
 *
 * If the service is unavailable, all calls resolve with graceful fallbacks
 * so the main verification flow is never hard-blocked by an AI hiccup.
 */

const http = require('http');

const HOST = process.env.INSIGHTFACE_HOST || 'localhost';
const PORT = parseInt(process.env.INSIGHTFACE_PORT || '6800', 10);
const TIMEOUT_MS = 30_000;

// ─── Internal HTTP helper ─────────────────────────────────────────────────────

function post(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: HOST,
      port:     PORT,
      path,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: TIMEOUT_MS,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data',  (chunk) => { data += chunk; });
      res.on('end',   () => {
        try   { resolve(JSON.parse(data)); }
        catch { reject(new Error('InsightFace: invalid JSON response')); }
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('InsightFace: request timed out')); });
    req.on('error',   reject);
    req.write(payload);
    req.end();
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Quick health check — resolves true/false without throwing.
 */
async function isServiceAvailable() {
  return new Promise((resolve) => {
    const req = http.get(
      { hostname: HOST, port: PORT, path: '/health', timeout: 4_000 },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end',  () => {
          try {
            const json = JSON.parse(data);
            resolve(json.status === 'ok');
          } catch {
            resolve(false);
          }
        });
      }
    );
    req.on('error',   () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

/**
 * Run passive liveness / anti-spoofing on one or more base64 frames.
 *
 * @param {string[]} framesBase64  - Array of base64-encoded JPEG/PNG frames
 * @returns {Promise<{ score: number, real: boolean, frame_scores: number[], detail: object, error?: string }>}
 */
async function checkAntispoof(framesBase64) {
  try {
    const result = await post('/antispoofing', { frames: framesBase64 });
    console.log(`[InsightFace] antispoof score=${result.score} real=${result.real} frames=${framesBase64.length}`);
    return result;
  } catch (err) {
    console.warn(`[InsightFace] checkAntispoof failed (${err.message}) — failing open`);
    return { score: 0.6, real: true, frame_scores: [], detail: {}, error: err.message };
  }
}

/**
 * Compare two face images using ArcFace embeddings.
 *
 * @param {string} image1Base64  - Base64 profile photo
 * @param {string} image2Base64  - Base64 verification selfie/frame
 * @returns {Promise<{ similarity: number, cosine: number, verified: boolean, error?: string }>}
 */
async function compareFacesInsight(image1Base64, image2Base64) {
  try {
    const result = await post('/compare', { image1: image1Base64, image2: image2Base64 });
    console.log(`[InsightFace] compare cosine=${result.cosine} similarity=${result.similarity} verified=${result.verified}`);
    return result;
  } catch (err) {
    console.warn(`[InsightFace] compareFaces failed (${err.message}) — falling back to faceVerifier`);
    return { similarity: 0, cosine: 0, verified: false, error: err.message };
  }
}

module.exports = { isServiceAvailable, checkAntispoof, compareFacesInsight };
