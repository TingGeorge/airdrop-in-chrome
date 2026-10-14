#!/bin/bash
# Builds a universal (Apple silicon + Intel) airdrop-host into build/.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$REPO_DIR/build"
mkdir -p "$BUILD_DIR"

for arch in arm64 x86_64; do
  xcrun swiftc -O -target "$arch-apple-macos11" \
    -o "$BUILD_DIR/airdrop-host-$arch" "$REPO_DIR/native-host/AirDropHost.swift"
done
lipo -create -output "$BUILD_DIR/airdrop-host" "$BUILD_DIR/airdrop-host-arm64" "$BUILD_DIR/airdrop-host-x86_64"
rm -f "$BUILD_DIR/airdrop-host-arm64" "$BUILD_DIR/airdrop-host-x86_64"
codesign --force --sign - "$BUILD_DIR/airdrop-host"
lipo -info "$BUILD_DIR/airdrop-host"
