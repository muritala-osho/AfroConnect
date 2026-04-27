#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."

npm install --legacy-peer-deps

REPO_ROOT="$(cd ../ && pwd)"

NIX_LIB_PATH=""
if [ -f "$REPO_ROOT/replit.nix" ]; then
  NIX_LIB_PATH="$(nix --extra-experimental-features 'nix-command' eval --impure --raw --expr \
    "let pkgs = import <nixpkgs> {}; in pkgs.lib.makeLibraryPath (import $REPO_ROOT/replit.nix { inherit pkgs; }).deps" \
    2>/dev/null || true)"
fi

if [ -n "$NIX_LIB_PATH" ]; then
  export LD_LIBRARY_PATH="${NIX_LIB_PATH}${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
fi

export EXPO_FORCE_WEBCONTAINER_ENV=1

exec ./node_modules/.bin/expo start --tunnel "$@"
