#!/usr/bin/env python3
"""Smoke-tests the native messaging protocol of the AirDrop host.

Usage: python3 tests/test_host.py path/to/airdrop-host

Doesn't open the AirDrop window: it only checks requests the host answers
without user interaction.
"""

import json
import struct
import subprocess
import sys


def call(binary, payload, raw=None):
    if raw is None:
        body = json.dumps(payload).encode()
        raw = struct.pack("<I", len(body)) + body
    proc = subprocess.run([binary], input=raw, capture_output=True, timeout=30)
    out = proc.stdout
    assert proc.returncode == 0, f"exit code {proc.returncode} (stderr: {proc.stderr!r})"
    assert len(out) >= 4, f"no reply (stderr: {proc.stderr!r})"
    (length,) = struct.unpack("<I", out[:4])
    assert len(out) == 4 + length, f"reply length mismatch: header {length}, got {len(out) - 4}"
    return json.loads(out[4:])


def main():
    binary = sys.argv[1]
    cases = [
        ({"action": "ping"}, None, lambda r: r["ok"] is True and r["version"]),
        ({"action": "bogus"}, None, lambda r: r["ok"] is False and "error" in r),
        ({}, None, lambda r: r["ok"] is False),
        ({"action": "share", "url": "javascript:alert(1)"}, None, lambda r: r["ok"] is False),
        ({"action": "share"}, None, lambda r: r["ok"] is False),
        ({"action": "share", "url": 5}, None, lambda r: r["ok"] is False),
        ({"action": "share", "url": "chrome://settings"}, None, lambda r: r["ok"] is False),
        ({"action": "share", "url": "file:///definitely/not/here.pdf"}, None,
         lambda r: r["ok"] is False and "doesn't exist" in r["error"]),
        (None, b"", lambda r: r["ok"] is False),
        (None, struct.pack("<I", 10) + b"{}", lambda r: r["ok"] is False),
        (None, struct.pack("<I", 3) + b"[1]", lambda r: r["ok"] is False),
        (None, struct.pack("<I", 0xFFFFFFF0) + b"{}", lambda r: r["ok"] is False),
    ]
    for payload, raw, check in cases:
        reply = call(binary, payload, raw)
        label = payload if raw is None else raw
        assert check(reply), f"unexpected reply for {label!r}: {reply!r}"
        print(f"ok  {label!r} -> {reply}")
    print("All native host checks passed.")


if __name__ == "__main__":
    main()
