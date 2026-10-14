import { ping } from "./native.js";

const dot = document.getElementById("status-dot");
const text = document.getElementById("status-text");
const detail = document.getElementById("status-detail");
const button = document.getElementById("test");

document.getElementById("extension-id").textContent = chrome.runtime.id;
for (const el of document.querySelectorAll(".id-placeholder")) {
  el.textContent = chrome.runtime.id;
}

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
    show("ok", `AirDrop helper is installed (v${result.version}). You're all set!`);
  } else if (result.hostMissing) {
    show("error", "The AirDrop helper isn't installed yet. Follow the steps below.", `Chrome said: ${result.error}`);
  } else {
    show("error", "The AirDrop helper is installed but didn't respond correctly.", result.error);
  }
  button.disabled = false;
}

button.addEventListener("click", check);
check();
