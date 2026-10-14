import { isShareable, parseUserUrl, shareUrl } from "./native.js";

const MENU_SHARE_PAGE = "airdrop-share-page";
const MENU_SHARE_LINK = "airdrop-share-link";
const MENU_SHARE_MEDIA = "airdrop-share-media";
const MENU_SEND_LINK = "airdrop-send-link";

const SEND_PAGE = "send.html";

const DEFAULT_TITLE = "Share this page via AirDrop";

// The badge outlives the service worker. If the worker was stopped mid-flash,
// don't leave a stale "…" or "✓" behind.
chrome.action.setBadgeText({ text: "" }).catch(() => {});
chrome.action.setTitle({ title: DEFAULT_TITLE }).catch(() => {});

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: MENU_SHARE_PAGE,
    title: "Share Page via AirDrop",
    contexts: ["page", "frame", "selection"],
  });
  chrome.contextMenus.create({
    id: MENU_SHARE_LINK,
    title: "Share Link via AirDrop",
    contexts: ["link"],
  });
  chrome.contextMenus.create({
    id: MENU_SHARE_MEDIA,
    title: "Share Media Address via AirDrop",
    contexts: ["image", "video", "audio"],
  });
  // Right-click the toolbar button.
  chrome.contextMenus.create({
    id: MENU_SEND_LINK,
    title: "Send a Link via AirDrop…",
    contexts: ["action"],
  });

  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.runtime.openOptionsPage().catch(() => {});
  }
});

chrome.action.onClicked.addListener((tab) => {
  share(tab.url, tab.title);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case MENU_SEND_LINK:
      openSendWindow().catch(() => {});
      break;
    // A web page can link to file:///…; only send local files from a local page.
    case MENU_SHARE_LINK:
      share(info.linkUrl, info.linkUrl, { allowFile: isFilePage(info.pageUrl) });
      break;
    case MENU_SHARE_MEDIA:
      share(info.srcUrl, info.srcUrl, { allowFile: isFilePage(info.pageUrl) });
      break;
    default:
      share(info.pageUrl || tab?.url, tab?.title);
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "send-link") openSendWindow().catch(() => {});
});

// Address bar: type "airdrop", a space, paste a link, press Return.
chrome.omnibox.setDefaultSuggestion({ description: "Send a link via AirDrop: paste a URL and press Return" });

chrome.omnibox.onInputChanged.addListener((text) => {
  const url = parseUserUrl(text);
  chrome.omnibox.setDefaultSuggestion({
    description: url
      ? `Send via AirDrop: <url>${escapeXml(url)}</url>`
      : text.trim()
        ? `Not a web link: <dim>${escapeXml(text.trim())}</dim>`
        : "Send a link via AirDrop: paste a URL and press Return",
  });
});

chrome.omnibox.onInputEntered.addListener((text) => {
  // Don't let feedback for this entry overwrite the badge of a share in progress.
  if (busy) {
    chrome.action.setTitle({ title: "An AirDrop window is already open." }).catch(() => {});
    return;
  }
  const url = parseUserUrl(text);
  if (url) {
    share(url, url);
  } else {
    flash("✕", "#d93025", "That isn't a web link (http or https).");
  }
});

// From send.html.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;
  if (message?.type === "share-link") {
    const url = parseUserUrl(message.url);
    if (!url) {
      sendResponse({ ok: false, error: "That isn't a web link (http or https)." });
      return false;
    }
    share(url, url).then(sendResponse);
    return true; // respond asynchronously
  }
  if (message?.type === "open-send-window") {
    openSendWindow().then(
      () => sendResponse({ ok: true }),
      (err) => sendResponse({ ok: false, error: err?.message ?? String(err) }),
    );
    return true;
  }
  return false;
});

// Opens the "Send a Link" window, or focuses it if it's already open.
// Concurrent calls share one attempt: getContexts can't see a window that's still loading.
let opening;
function openSendWindow() {
  opening ??= doOpenSendWindow().finally(() => {
    opening = undefined;
  });
  return opening;
}

async function doOpenSendWindow() {
  const url = chrome.runtime.getURL(SEND_PAGE);
  const [existing] = await chrome.runtime.getContexts({ contextTypes: ["TAB"], documentUrls: [url] });
  if (existing?.windowId !== undefined && existing.windowId !== -1) {
    await chrome.windows.update(existing.windowId, { focused: true, state: "normal" });
    return;
  }
  await chrome.windows.create({ url, type: "popup", width: 460, height: 240, focused: true });
}

function isFilePage(url) {
  return typeof url === "string" && url.startsWith("file:");
}

// Omnibox descriptions are XML; escape what the user typed.
const XML_ESCAPES = { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" };
function escapeXml(text) {
  return text.replace(/[<>&"']/g, (c) => XML_ESCAPES[c]);
}

let busy = false;
let flashTimer;

// Resolves with the helper's result so callers (like send.html) can show it.
async function share(url, title, { allowFile = true } = {}) {
  // The AirDrop window from the previous click is still open.
  if (busy) return { ok: false, busy: true, error: "An AirDrop window is already open." };

  if (!url || !isShareable(url, { allowFile })) {
    await flash("✕", "#d93025", "Only web pages (http/https) and local files can be shared via AirDrop.");
    return { ok: false, error: "Only web pages (http/https) and local files can be shared via AirDrop." };
  }

  busy = true;
  await setBadge("…", "#1a73e8", "Opening AirDrop…");
  try {
    const result = await shareUrl(url, title || "");
    if (result.ok) {
      await flash("✓", "#188038", "Sent via AirDrop");
    } else if (result.cancelled) {
      await setBadge("", null, DEFAULT_TITLE);
    } else if (result.hostMissing || result.forbidden) {
      await flash("!", "#d93025", "The AirDrop helper needs to be set up. Opening setup…", 6000);
      chrome.runtime.openOptionsPage().catch(() => {});
    } else {
      await flash("!", "#d93025", `AirDrop failed: ${result.error}`, 6000);
    }
    return result;
  } finally {
    busy = false;
  }
}

async function setBadge(text, color, title) {
  clearTimeout(flashTimer);
  await chrome.action.setBadgeText({ text });
  if (color) await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setTitle({ title });
}

async function flash(text, color, title, ms = 2500) {
  await setBadge(text, color, title);
  flashTimer = setTimeout(() => setBadge("", null, DEFAULT_TITLE), ms);
}
