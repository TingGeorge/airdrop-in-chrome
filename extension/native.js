// Shared helpers for talking to the native AirDrop host (native-host/AirDropHost.swift).

export const HOST_NAME = "com.tinggeorge.airdrop_for_chrome";

// Schemes AirDrop can do something useful with. file:// URLs send the file itself,
// so they're only allowed when the user is looking at that file (allowFile).
export function isShareable(url, { allowFile = true } = {}) {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:" || (allowFile && protocol === "file:");
  } catch {
    return false;
  }
}

// Wrappers chat apps and docs put around links: <https://…>, "https://…", (https://…).
const WRAPPERS = [["<", ">"], ['"', '"'], ["'", "'"], ["“", "”"], ["(", ")"]];

const count = (text, char) => text.split(char).length - 1;

// Removes wrappers and trailing sentence punctuation from a pasted link, repeatedly,
// so combinations like `<https://x.com/a>.` or `"(https://x.com/a)",` come out clean.
function cleanPasted(text) {
  let t = (text ?? "").trim();
  let previous;
  let passes = 0;
  do {
    previous = t;
    for (const [open, close] of WRAPPERS) {
      if (t.length > 2 && t.startsWith(open) && t.endsWith(close)) t = t.slice(1, -1).trim();
    }
    // [https://…] — but not an IPv6 host like [::1].
    if (/^\[[a-z][a-z0-9+.-]*:\/\/.*\]$/i.test(t)) t = t.slice(1, -1).trim();
    t = t.replace(/[.,;:!?'"”’>]+$/, "");
    if (t.endsWith("]") && count(t, "]") > count(t, "[")) t = t.slice(0, -1);
    // A trailing ")" closes the sentence, unless it balances one in the URL (Foo_(bar)).
    if (t.endsWith(")") && count(t, ")") > count(t, "(")) t = t.slice(0, -1);
    // Same for openers left behind once their closer was stripped above.
    t = t.replace(/^[<"“'‘]+/, "");
    for (const [open, close] of [["(", ")"], ["[", "]"]]) {
      if (t.startsWith(open) && count(t, open) > count(t, close)) t = t.slice(1);
    }
  } while (t !== previous && ++passes < 10);
  return t;
}

const DOMAIN = /^(?:[a-z0-9-]+\.)+[a-z][a-z0-9-]*[a-z0-9]$/i;
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
// Real links are far shorter; the cap keeps a huge paste from stalling the page.
const MAX_LENGTH = 4096;

// Turns what the user pasted or typed into a shareable web URL, or returns null.
// Without a scheme, "example.com/page" becomes https://…, while localhost, IP
// addresses and host:port (dev servers, LAN devices) become http://….
export function parseUserUrl(text) {
  if ((text ?? "").length > MAX_LENGTH) return null;
  const trimmed = cleanPasted(text);
  if (!trimmed || /\s/.test(trimmed)) return null;
  // "example.com:8080/x" and "localhost:3000" are host:port, not a scheme.
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^[^/:]+:\d+(?:[/?#]|$)/.test(trimmed);
  try {
    if (hasScheme) {
      const url = new URL(trimmed);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
    }
    const probe = new URL(`https://${trimmed}`);
    const host = probe.hostname;
    // "user@example.com" is an email address, not a link.
    if (probe.username || probe.password) return null;
    // new URL() turns "1.2" into 1.0.0.2, so an IPv4 host must be written out in full.
    const isIp = (IPV4.test(host) && trimmed.startsWith(host)) || host.startsWith("[");
    const isLocal = host === "localhost" || isIp;
    if (!isLocal && !DOMAIN.test(host)) return null;
    // Read the port from the text: new URL() drops a default port like :443.
    const port = /^[^/?#]*:(\d+)(?:[/?#]|$)/.exec(trimmed)?.[1];
    const secure = port === "443" || port === "8443" || (!isLocal && !port);
    return new URL(`${secure ? "https" : "http"}://${trimmed}`).href;
  } catch {
    return null;
  }
}

// Finds the first link in a pasted block of text, e.g. a whole chat message.
// Returns null if there's no http(s) link in it and the text isn't a link itself.
export function findUrlInText(text) {
  const direct = parseUserUrl(text);
  if (direct) return direct;
  for (const token of (text ?? "").slice(0, 20 * MAX_LENGTH).split(/\s+/)) {
    // Also finds links inside Markdown, e.g. [title](https://…).
    const start = token.search(/https?:\/\//i);
    if (start !== -1) {
      // In [https://a](https://a) the first link ends where the Markdown target begins.
      const url = parseUserUrl(token.slice(start).split("](")[0]);
      if (url) return url;
    }
  }
  return null;
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
