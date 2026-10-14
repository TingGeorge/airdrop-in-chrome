import { ping } from "./native.js";

// The ID the "key" in manifest.json gives an unpacked install; install.sh allows it by default.
const DEFAULT_EXTENSION_ID = "bknlnfilkdendhgjbkjinfammcfcpgpn";

const dot = document.getElementById("status-dot");
const text = document.getElementById("status-text");
const detail = document.getElementById("status-detail");
const button = document.getElementById("test");

document.getElementById("extension-id").textContent = chrome.runtime.id;
for (const el of document.querySelectorAll(".id-placeholder")) {
  el.textContent = chrome.runtime.id;
}
document.getElementById("id-hint").hidden = chrome.runtime.id === DEFAULT_EXTENSION_ID;

function show(state, message, extra) {
  dot.className = `dot ${state}`;
  text.textContent = message;
  detail.hidden = !extra;
  detail.textContent = extra ?? "";
}

async function check() {
  button.disabled = true;
  show("pending", "Checking the AirDrop helper…");
  const result = await ping();
  if (result.ok) {
    const version = result.version ? ` (v${result.version})` : "";
    show("ok", `AirDrop helper is installed${version}. You're all set!`);
  } else if (result.hostMissing) {
    show("error", "The AirDrop helper isn't installed yet. Follow the steps below.", `Chrome said: ${result.error}`);
  } else if (result.forbidden) {
    show(
      "error",
      "The AirDrop helper is installed, but not for this extension ID.",
      `Run: ./install.sh --extension-id ${chrome.runtime.id}  then click Check again.`,
    );
  } else {
    show("error", "The AirDrop helper is installed but didn't respond correctly.", result.error);
  }
  button.disabled = false;
}

async function showShortcut() {
  const commands = await chrome.commands.getAll();
  const shortcut = commands.find((c) => c.name === "_execute_action")?.shortcut;
  if (shortcut) {
    document.getElementById("shortcut").textContent = shortcut;
  } else {
    document.getElementById("shortcut-set").hidden = true;
    document.getElementById("shortcut-unset").hidden = false;
  }
}

button.addEventListener("click", check);
// Re-check when the user comes back from running install.sh in Terminal.
window.addEventListener("focus", () => {
  if (!button.disabled) check();
});
showShortcut();
check();
