#!/bin/bash
# Builds the AirDrop native messaging host and registers it with Chrome
# (and other Chromium-based browsers that are installed).
#
# Uses the prebuilt helper in bin/ (included in release downloads) when it's
# there, otherwise compiles native-host/AirDropHost.swift.
#
# Usage: ./install.sh [--extension-id ID]... [--build-from-source]

set -euo pipefail

HOST_NAME="com.tinggeorge.airdrop_for_chrome"
# Fixed by the "key" in extension/manifest.json, so it's the same for everyone
# who loads the unpacked extension.
DEFAULT_EXTENSION_ID="bknlnfilkdendhgjbkjinfammcfcpgpn"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="$HOME/Library/Application Support/AirDropForChrome"
HOST_BINARY="$INSTALL_DIR/airdrop-host"
PREBUILT_BINARY="$REPO_DIR/bin/airdrop-host"
APP_SUPPORT="$HOME/Library/Application Support"

# Where each browser looks for per-user native messaging host manifests.
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

extension_ids=()
build_from_source=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --extension-id)
      [[ $# -ge 2 ]] || { echo "error: --extension-id needs a value" >&2; exit 1; }
      if [[ ! "$2" =~ ^[a-p]{32}$ ]]; then
        echo "error: '$2' doesn't look like a Chrome extension ID (32 letters a-p)" >&2
        exit 1
      fi
      extension_ids+=("$2")
      shift 2
      ;;
    --build-from-source)
      build_from_source=1
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--extension-id ID]... [--build-from-source]"
      echo "Installs the AirDrop helper and registers it with your Chromium-based browsers."
      exit 0
      ;;
    *)
      echo "error: unknown option '$1'" >&2
      exit 1
      ;;
  esac
done
if [[ ${#extension_ids[@]} -eq 0 ]]; then
  extension_ids=("$DEFAULT_EXTENSION_ID")
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "error: AirDrop is only available on macOS." >&2
  exit 1
fi

mkdir -p "$INSTALL_DIR"
if [[ $build_from_source -eq 0 && -f "$PREBUILT_BINARY" ]]; then
  echo "==> Installing the prebuilt AirDrop helper…"
  cp -f "$PREBUILT_BINARY" "$HOST_BINARY"
  # A browser download marks the file as quarantined, and Gatekeeper would then
  # refuse to let Chrome launch it. You chose to install it, so clear the flag
  # and re-apply the ad-hoc signature that Apple silicon requires.
  xattr -c "$HOST_BINARY" 2>/dev/null || true
  codesign --force --sign - "$HOST_BINARY" >/dev/null 2>&1 || true
else
  if ! xcrun --find swiftc >/dev/null 2>&1; then
    echo "error: the Swift compiler wasn't found." >&2
    echo "Either download a release from" >&2
    echo "    https://github.com/TingGeorge/airdrop-in-chrome/releases" >&2
    echo "(it includes a prebuilt helper), or install Apple's Command Line Tools with" >&2
    echo "    xcode-select --install" >&2
    echo "and run this script again." >&2
    exit 1
  fi
  echo "==> Building the AirDrop helper…"
  build_tmp="$(mktemp -d)"
  trap 'rm -rf "$build_tmp"' EXIT
  xcrun swiftc -O \
    -o "$build_tmp/airdrop-host" \
    "$REPO_DIR/native-host/AirDropHost.swift"
  mv -f "$build_tmp/airdrop-host" "$HOST_BINARY"
fi
chmod 755 "$HOST_BINARY"
echo "    Installed $HOST_BINARY"

allowed_origins=""
for id in "${extension_ids[@]}"; do
  [[ -n "$allowed_origins" ]] && allowed_origins+=", "
  allowed_origins+="\"chrome-extension://$id/\""
done

# JSON-escape the binary path (it contains spaces; quotes/backslashes are unlikely but possible).
escaped_path="${HOST_BINARY//\\/\\\\}"
escaped_path="${escaped_path//\"/\\\"}"

manifest="{
  \"name\": \"$HOST_NAME\",
  \"description\": \"Share via AirDrop helper\",
  \"path\": \"$escaped_path\",
  \"type\": \"stdio\",
  \"allowed_origins\": [$allowed_origins]
}"

echo "==> Registering with browsers…"
registered=0
for browser in "${BROWSER_DIRS[@]}"; do
  browser_dir="$APP_SUPPORT/$browser"
  # Always register with Google Chrome; others only if they're installed.
  if [[ "$browser" != "Google/Chrome" && ! -d "$browser_dir" ]]; then
    continue
  fi
  hosts_dir="$browser_dir/NativeMessagingHosts"
  mkdir -p "$hosts_dir"
  printf '%s\n' "$manifest" > "$hosts_dir/$HOST_NAME.json"
  echo "    $browser"
  registered=$((registered + 1))
done

echo
echo "Done! Registered with $registered browser(s) for extension ID(s): ${extension_ids[*]}"
echo "Open the extension's setup page and click \"Check again\" to verify."
