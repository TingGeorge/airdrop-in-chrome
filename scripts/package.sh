#!/bin/bash
# Packages a release into dist/. Expects build/airdrop-host (scripts/build-host.sh).
#   dist/airdrop-in-chrome-vX.Y.Z.zip       extension + prebuilt helper + installer
#   dist/share-via-airdrop-extension-vX.Y.Z.zip   extension only (Chrome Web Store upload)
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

version="$(scripts/version.sh)"
[[ -x build/airdrop-host ]] || { echo "error: build/airdrop-host missing; run scripts/build-host.sh" >&2; exit 1; }

rm -rf dist
stage="dist/airdrop-in-chrome"
mkdir -p "$stage/bin"
cp -R extension native-host install.sh uninstall.sh README.md "$stage/"
cp build/airdrop-host "$stage/bin/airdrop-host"

(cd dist && zip -qry "airdrop-in-chrome-v$version.zip" airdrop-in-chrome)
(cd extension && zip -qr "../dist/share-via-airdrop-extension-v$version.zip" . -x '.*')
rm -rf "$stage"
ls -l dist
