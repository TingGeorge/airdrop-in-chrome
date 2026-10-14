// Shared helpers for talking to the native AirDrop host (native-host/AirDropHost.swift).

export const HOST_NAME = "com.tinggeorge.airdrop_for_chrome";

// Schemes AirDrop can do something useful with. file:// URLs send the file itself.
const SHAREABLE_SCHEMES = new Set(["http:", "https:", "file:"]);

export function isShareable(url) {
  try {
    return SHAREABLE_SCHEMES.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

function errorResult(error) {
  return {
    ok: false,
    error,
    // "Specified native messaging host not found."
    hostMissing: /native messaging host not found/i.test(error),
    // "Access to the specified native messaging host is forbidden." (extension ID not in allowed_origins)
    forbidden: /native messaging host is forbidden/i.test(error),
  };
}

// Sends one message and resolves with the host's single reply.
//
// Uses a port (connectNative) rather than sendNativeMessage because an open
// native messaging port keeps the MV3 service worker alive while the user is
// still picking a device in the AirDrop window.
export function sendToHost(message, { timeoutMs } = {}) {
  return new Promise((resolve) => {
    let port;
    let timer;
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        port?.disconnect();
      } catch {
        // Already disconnected.
      }
      resolve(result);
    };

    try {
      port = chrome.runtime.connectNative(HOST_NAME);
    } catch (err) {
      finish(errorResult(err?.message ?? String(err)));
      return;
    }

    port.onMessage.addListener((reply) => {
      finish(reply && typeof reply === "object" ? reply : errorResult("The AirDrop helper sent an invalid reply."));
    });
    port.onDisconnect.addListener(() => {
      finish(errorResult(chrome.runtime.lastError?.message ?? "The AirDrop helper exited without replying."));
    });
    if (timeoutMs) {
      timer = setTimeout(() => finish(errorResult("The AirDrop helper didn't respond in time.")), timeoutMs);
    }

    port.postMessage(message);
  });
}

export function ping() {
  return sendToHost({ action: "ping" }, { timeoutMs: 5000 });
}

// The helper gives up on its own after 10 minutes; this is a backstop in case
// it hangs, so a stuck port can't block every later share.
const SHARE_TIMEOUT_MS = 11 * 60 * 1000;

export function shareUrl(url, title) {
  return sendToHost({ action: "share", url, title }, { timeoutMs: SHARE_TIMEOUT_MS });
}
