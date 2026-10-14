#!/bin/bash
# Prints the release version and fails if the extension and helper disagree.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ext_version="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$REPO_DIR/extension/manifest.json")"
host_version="$(sed -n 's/^let hostVersion = "\(.*\)"$/\1/p' "$REPO_DIR/native-host/AirDropHost.swift")"

if [[ "$ext_version" != "$host_version" ]]; then
  echo "error: extension/manifest.json version ($ext_version) != AirDropHost.swift hostVersion ($host_version)" >&2
  exit 1
fi
echo "$ext_version"
