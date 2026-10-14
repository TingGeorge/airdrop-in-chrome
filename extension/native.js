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

// Chrome reports a missing/misconfigured host with these messages.
export function isHostMissingError(message = "") {
  return /native messaging host not found|access to the specified native messaging host is forbidden/i.test(message);
}

export async function sendToHost(message) {
  try {
    const response = await chrome.runtime.sendNativeMessage(HOST_NAME, message);
    return response ?? { ok: false, error: "The AirDrop helper returned no response." };
  } catch (err) {
    const error = err?.message ?? String(err);
    return { ok: false, error, hostMissing: isHostMissingError(error) };
  }
}

export function ping() {
  return sendToHost({ action: "ping" });
}

export function shareUrl(url, title) {
  return sendToHost({ action: "share", url, title });
}
