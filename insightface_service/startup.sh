#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "[InsightFace] Installing Python dependencies…"
pip install -q --disable-pip-version-check -r requirements.txt

echo "[InsightFace] Starting Flask service on port ${INSIGHTFACE_PORT:-5050}…"
exec python app.py
