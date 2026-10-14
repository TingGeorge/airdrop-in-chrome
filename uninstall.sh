#!/bin/bash
# Removes the AirDrop native messaging host installed by install.sh.

set -euo pipefail

HOST_NAME="com.tinggeorge.airdrop_for_chrome"
INSTALL_DIR="$HOME/Library/Application Support/AirDropForChrome"
APP_SUPPORT="$HOME/Library/Application Support"

# Where each browser looks for per-user native messaging host manifests
# ("<dir under ~/Library/Application Support>|<app name>"). Keep in sync with
# install.sh.
BROWSERS=(
  "Google/Chrome|Google Chrome"
  "Google/Chrome Beta|Google Chrome Beta"
  "Google/Chrome Dev|Google Chrome Dev"
  "Google/Chrome Canary|Google Chrome Canary"
  "Chromium|Chromium"
  "BraveSoftware/Brave-Browser|Brave Browser"
  "BraveSoftware/Brave-Browser-Beta|Brave Browser Beta"
  "BraveSoftware/Brave-Browser-Nightly|Brave Browser Nightly"
  "Microsoft Edge|Microsoft Edge"
  "Microsoft Edge Beta|Microsoft Edge Beta"
  "Microsoft Edge Dev|Microsoft Edge Dev"
  "Microsoft Edge Canary|Microsoft Edge Canary"
  "Vivaldi|Vivaldi"
  "Arc/User Data|Arc"
)

for entry in "${BROWSERS[@]}"; do
  manifest="$APP_SUPPORT/${entry%%|*}/NativeMessagingHosts/$HOST_NAME.json"
  if [[ -f "$manifest" ]]; then
    rm -f "$manifest"
    echo "Removed $manifest"
  fi
done

if [[ -d "$INSTALL_DIR" ]]; then
  rm -rf "$INSTALL_DIR"
  echo "Removed $INSTALL_DIR"
fi

echo "Done. You can now remove the extension from chrome://extensions."
