#!/bin/bash
# Removes the AirDrop native messaging host installed by install.sh.

set -euo pipefail

HOST_NAME="com.tinggeorge.airdrop_for_chrome"
INSTALL_DIR="$HOME/Library/Application Support/AirDropForChrome"
APP_SUPPORT="$HOME/Library/Application Support"

BROWSER_DIRS=(
  "Google/Chrome"
  "Google/Chrome Beta"
  "Google/Chrome Dev"
  "Google/Chrome Canary"
  "Chromium"
  "BraveSoftware/Brave-Browser"
  "Microsoft Edge"
  "Vivaldi"
  "Arc/User Data"
)

for browser in "${BROWSER_DIRS[@]}"; do
  manifest="$APP_SUPPORT/$browser/NativeMessagingHosts/$HOST_NAME.json"
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
