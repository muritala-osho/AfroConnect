"""
InsightFace Microservice
------------------------
Provides two endpoints used by the AfroConnect Node.js backend:

  POST /antispoofing  - Passive liveness: detects print/screen replay attacks
  POST /compare       - ArcFace-based face similarity (replaces face-api.js)
  GET  /health        - Service health / model load status

Anti-spoofing uses three complementary signals:
  1. Laplacian variance   – real skin has micro-texture; flat photos do not
  2. FFT frequency ratio  – screens/prints have distinctive frequency patterns
  3. Color channel spread – real faces have natural RGB variation

Face comparison uses InsightFace's buffalo_l (ArcFace backbone) for high
accuracy across lighting, angle, and age differences.
"""

import os
import sys
import base64
import traceback
import logging

import numpy as np
import cv2
from flask import Flask, request, jsonify

logging.basicConfig(
    level=logging.INFO,
    format='[InsightFace] %(levelname)s %(message)s',
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

_face_app = None
_models_ready = False


def get_face_app():
    global _face_app, _models_ready
    if _face_app is not None:
        return _face_app
    try:
        import insightface
        from insightface.app import FaceAnalysis
        logger.info('Loading buffalo_l models (first run downloads ~300 MB)…')
        _face_app = FaceAnalysis(
            name='buffalo_l',
            providers=['CPUExecutionProvider'],
        )
        _face_app.prepare(ctx_id=-1, det_size=(640, 640))
        _models_ready = True
        logger.info('buffalo_l models ready.')
    except Exception as exc:
        logger.error(f'Could not load InsightFace models: {exc}')
        _face_app = None
    return _face_app


def decode_image(b64_string: str):
    """Base64 string → OpenCV BGR ndarray."""
    try:
        if ',' in b64_string:
            b64_string = b64_string.split(',', 1)[1]
        raw = base64.b64decode(b64_string)
        arr = np.frombuffer(raw, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return img
    except Exception as exc:
        logger.warning(f'decode_image failed: {exc}')
        return None


def passive_liveness_score(img_bgr) -> dict:
    """
    Texture-based passive liveness detection.

    Returns a dict:
      score     – 0.0 (definite spoof) → 1.0 (definite real face)
      real      – bool (score >= 0.42)
      detail    – breakdown of sub-scores
    """
    if img_bgr is None or img_bgr.size == 0:
        return {'score': 0.0, 'real': False, 'detail': {}}

    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    # ── 1. Laplacian variance ───────────────────────────────────────
    # Real skin has micro-texture (high variance); printed / screen
    # photos look smoother.  Typical real frame: 200–1200; spoof: < 80.
    lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    lap_score = min(lap_var / 900.0, 1.0)

    # ── 2. FFT high-frequency ratio ─────────────────────────────────
    # Printed/screen images concentrate energy differently in frequency
    # domain compared with natural 3-D faces.
    f = np.fft.fft2(gray)
    fshift = np.fft.fftshift(f)
    mag = 20 * np.log(np.abs(fshift) + 1)
    h, w = gray.shape
    cx, cy = h // 4, w // 4
    center = mag[cx:3*cx, cy:3*cy].mean()
    edge   = mag.copy()
    edge[cx:3*cx, cy:3*cy] = 0
    freq_ratio = center / (edge.mean() + 1e-9)
    # Ratio > 1.6 suggests print/screen patterns
    freq_score = float(np.clip(1.0 - (freq_ratio - 0.8) / 1.2, 0.0, 1.0))

    # ── 3. Color channel natural spread ────────────────────────────
    b_ch, g_ch, r_ch = cv2.split(img_bgr)
    channel_std = float(np.std([b_ch.mean(), g_ch.mean(), r_ch.mean()]))
    # Real skin: std 8-30; flat photo: 0-4
    color_score = float(np.clip(channel_std / 20.0, 0.0, 1.0))

    score = round(0.50 * lap_score + 0.30 * freq_score + 0.20 * color_score, 4)

    return {
        'score': score,
        'real': score >= 0.42,
        'detail': {
            'laplacian_var': round(lap_var, 1),
            'lap_score':     round(lap_score, 3),
            'freq_ratio':    round(freq_ratio, 3),
            'freq_score':    round(freq_score, 3),
            'color_std':     round(channel_std, 2),
            'color_score':   round(color_score, 3),
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    fa = get_face_app()
    return jsonify({
        'status': 'ok',
        'models_ready': _models_ready,
        'insightface_loaded': fa is not None,
    })


@app.route('/antispoofing', methods=['POST'])
def antispoofing():
    """
    Passive liveness check on one or more base64-encoded image frames.

    Body (JSON):
      { "frames": ["<base64>", …] }   – preferred (multi-frame average)
      { "image":  "<base64>" }         – single frame fallback

    Response:
      { "score": 0-1, "real": bool, "frame_scores": [], "detail": {} }
    """
    try:
        data = request.get_json(force=True, silent=True) or {}

        # Accept either a list of frames or a single image key
        raw_frames = data.get('frames') or ([data['image']] if data.get('image') else [])
        if not raw_frames:
            return jsonify({'score': 0.0, 'real': False, 'error': 'No image data provided'}), 400

        frame_results = []
        for b64 in raw_frames:
            img = decode_image(b64)
            if img is None:
                continue
            result = passive_liveness_score(img)

            # Optionally blend InsightFace face quality as extra signal
            fa = get_face_app()
            if fa is not None:
                try:
                    faces = fa.get(img)
                    if faces:
                        det_score = float(faces[0].det_score)
                        result['score'] = round(0.70 * result['score'] + 0.30 * det_score, 4)
                        result['detail']['det_score'] = round(det_score, 3)
                        result['real'] = result['score'] >= 0.42
                except Exception as exc:
                    logger.warning(f'InsightFace quality blend failed: {exc}')

            frame_results.append(result)

        if not frame_results:
            return jsonify({'score': 0.0, 'real': False, 'error': 'Could not decode any frame'}), 400

        avg_score = round(float(np.mean([r['score'] for r in frame_results])), 4)
        is_real   = avg_score >= 0.42

        logger.info(f'[antispoofing] frames={len(frame_results)} avg_score={avg_score} real={is_real}')

        return jsonify({
            'score':        avg_score,
            'real':         is_real,
            'frame_scores': [r['score'] for r in frame_results],
            'detail':       frame_results[-1].get('detail', {}),
        })

    except Exception as exc:
        logger.error(f'[antispoofing] Unhandled error: {exc}')
        traceback.print_exc()
        # Fail open so a service hiccup never blocks legitimate users
        return jsonify({'score': 0.6, 'real': True, 'error': str(exc)})


@app.route('/compare', methods=['POST'])
def compare_faces():
    """
    ArcFace face similarity between two images.

    Body (JSON):
      { "image1": "<base64>", "image2": "<base64>" }

    Response:
      { "similarity": 0-1, "cosine": -1 to 1, "verified": bool }
    """
    try:
        fa = get_face_app()
        if fa is None:
            return jsonify({
                'similarity': 0.0,
                'verified': False,
                'error': 'InsightFace models not loaded — using fallback',
            }), 503

        data  = request.get_json(force=True, silent=True) or {}
        img1  = decode_image(data.get('image1', ''))
        img2  = decode_image(data.get('image2', ''))

        if img1 is None or img2 is None:
            return jsonify({'similarity': 0.0, 'verified': False,
                            'error': 'Could not decode one or both images'}), 400

        faces1 = fa.get(img1)
        faces2 = fa.get(img2)

        if not faces1:
            return jsonify({'similarity': 0.0, 'verified': False, 'error': 'No face in image1'}), 400
        if not faces2:
            return jsonify({'similarity': 0.0, 'verified': False, 'error': 'No face in image2'}), 400

        emb1 = faces1[0].embedding
        emb2 = faces2[0].embedding

        # ArcFace embeddings are L2-normalised → cosine = dot product
        cosine = float(np.dot(emb1, emb2) /
                       (np.linalg.norm(emb1) * np.linalg.norm(emb2) + 1e-9))

        # Map cosine [-1, 1] → similarity [0, 1]
        similarity = round((cosine + 1.0) / 2.0, 4)

        # ArcFace threshold: cosine >= 0.35 is same person (stringent production standard)
        verified = cosine >= 0.35

        logger.info(f'[compare] cosine={cosine:.4f} similarity={similarity} verified={verified}')

        return jsonify({
            'similarity': similarity,
            'cosine':     round(cosine, 4),
            'verified':   verified,
        })

    except Exception as exc:
        logger.error(f'[compare] Unhandled error: {exc}')
        traceback.print_exc()
        return jsonify({'similarity': 0.0, 'verified': False, 'error': str(exc)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    port = int(os.environ.get('INSIGHTFACE_PORT', '5050'))
    logger.info(f'Starting InsightFace service on port {port}')
    get_face_app()  # Pre-load models at startup
    app.run(host='0.0.0.0', port=port, debug=False, use_reloader=False)
