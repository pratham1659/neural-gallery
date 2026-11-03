#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
OUT_DIR="$DIR/build"
mkdir -p "$OUT_DIR"

echo "Compiling native Swift acceleration bridge for Apple Silicon..."

swiftc -emit-library -O \
  -module-name neural_bridge \
  "$DIR/src/VisionBridge.swift" \
  "$DIR/src/ClipBridge.swift" \
  "$DIR/src/AuthBridge.swift" \
  -o "$OUT_DIR/libneural_bridge.dylib"

echo "Successfully built: $OUT_DIR/libneural_bridge.dylib"
