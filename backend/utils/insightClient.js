/**
 * insightClient.js
 * ----------------
 * Thin Node.js HTTP client for the InsightFace Python microservice.
 *
 * Configuration (via environment variables):
 *   INSIGHTFACE_URL   – Full base URL, e.g. https://insightface.myserver.com
 *                       Set this in your .env for deployed environments.
 *   INSIGHTFACE_HOST  – Hostname fallback (default: localhost)
 *   INSIGHTFACE_PORT  – Port fallback    (default: 6800)
 *
 * The service exposes:
 *   POST /antispoofing  – passive liveness check
 *   POST /compare       – ArcFace face similarity
 *   GET  /health        – readiness probe
 *
 * All calls resolve with graceful fallbacks if the service is unavailable.
 */

const BASE_URL = process.env.INSIGHTFACE_URL
  ? process.env.INSIGHTFACE_URL.replace(/\/+$/, '')
  : `http://${process.env.INSIGHTFACE_HOST || 'localhost'}:${parseInt(process.env.INSIGHTFACE_PORT || '6800', 10)}`;

const TIMEOUT_MS = 30_000;

// ─── Internal fetch helper ────────────────────────────────────────────────────

async function post(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  controller.signal,
    });
    const json = await res.json();
    return json;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Quick health check — resolves true/false without throwing.
 */
async function isServiceAvailable() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    const res = await fetch(`${BASE_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);
    const json = await res.json();
    return json.status === 'ok';
  } catch {
    return false;
  }
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
    console.warn(`[InsightFace] compareFaces failed (${err.message}) — falling back`);
    return { similarity: 0, cosine: 0, verified: false, error: err.message };
  }
}

module.exports = { isServiceAvailable, checkAntispoof, compareFacesInsight };
