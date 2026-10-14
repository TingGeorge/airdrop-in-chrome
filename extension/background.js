import { isShareable, shareUrl } from "./native.js";

const MENU_SHARE_PAGE = "airdrop-share-page";
const MENU_SHARE_LINK = "airdrop-share-link";
const MENU_SHARE_MEDIA = "airdrop-share-media";

const DEFAULT_TITLE = "Share this page via AirDrop";

// The badge outlives the service worker. If the worker was stopped mid-flash,
// don't leave a stale "…" or "✓" behind.
chrome.action.setBadgeText({ text: "" });

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

  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.runtime.openOptionsPage();
  }
});

chrome.action.onClicked.addListener((tab) => {
  share(tab.url, tab.title);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case MENU_SHARE_LINK:
      share(info.linkUrl, info.linkUrl);
      break;
    case MENU_SHARE_MEDIA:
      share(info.srcUrl, info.srcUrl);
      break;
    default:
      share(info.pageUrl || tab?.url, tab?.title);
  }
});

let busy = false;
let flashTimer;

async function share(url, title) {
  // The AirDrop window from the previous click is still open.
  if (busy) return;

  if (!url || !isShareable(url)) {
    await flash("✕", "#d93025", "Only web pages (http/https) and local files can be shared via AirDrop.");
    return;
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
      chrome.runtime.openOptionsPage();
    } else {
      await flash("!", "#d93025", `AirDrop failed: ${result.error}`, 6000);
    }
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
