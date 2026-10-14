#!/bin/bash
# Packages a release into dist/. Expects build/airdrop-host (scripts/build-host.sh).
#   dist/airdrop-in-chrome-vX.Y.Z.zip       extension + prebuilt helper + installer
#   dist/share-via-airdrop-extension-vX.Y.Z.zip   extension only, without "key" (Chrome Web Store upload)
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

version="$(scripts/version.sh)"
[[ -x build/airdrop-host ]] || { echo "error: build/airdrop-host missing; run scripts/build-host.sh" >&2; exit 1; }

rm -rf dist
stage="dist/airdrop-in-chrome"
mkdir -p "$stage/bin"
cp -R extension native-host install.sh uninstall.sh README.md LICENSE "$stage/"
cp build/airdrop-host "$stage/bin/airdrop-host"
# The README's images.
mkdir -p "$stage/docs"
cp -R docs/images "$stage/docs/"

(cd dist && zip -qry "airdrop-in-chrome-v$version.zip" airdrop-in-chrome -x '.*' '*/.*')

# The Web Store assigns its own ID and rejects manifests that contain "key".
store="dist/store"
cp -R extension "$store"
python3 - "$store/manifest.json" <<'PY'
import json, sys
path = sys.argv[1]
with open(path) as f:
    manifest = json.load(f)
manifest.pop("key", None)
with open(path, "w") as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)
    f.write("\n")
PY
(cd "$store" && zip -qr "../share-via-airdrop-extension-v$version.zip" . -x '.*' '*/.*')
rm -rf "$stage" "$store"
ls -l dist
