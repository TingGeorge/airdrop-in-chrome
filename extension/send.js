import { parseUserUrl } from "./native.js";

const form = document.getElementById("form");
const input = document.getElementById("url");
const button = document.getElementById("send");
const status = document.getElementById("status");

const HINT = "Paste with ⌘V, then press Return.";
let sending = false;

function setStatus(text, state = "") {
  status.textContent = text;
  status.className = `status ${state}`;
}

function update() {
  const url = parseUserUrl(input.value);
  button.disabled = sending || !url;
  if (sending) return;
  if (!input.value.trim()) {
    setStatus(HINT);
  } else if (url) {
    setStatus(new URL(url).host);
  } else {
    setStatus("That isn't a web link (http or https).", "error");
  }
}

input.addEventListener("input", update);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const url = parseUserUrl(input.value);
  if (!url || sending) return;

  sending = true;
  input.disabled = true;
  button.disabled = true;
  setStatus("Opening AirDrop…", "pending");

  const result = await chrome.runtime.sendMessage({ type: "share-link", url });

  sending = false;
  input.disabled = false;
  if (result?.ok) {
    setStatus("Sent ✓", "ok");
    setTimeout(() => window.close(), 1200);
    return;
  }
  if (result?.cancelled) {
    setStatus("Cancelled. Press Return to try again.");
  } else if (result?.hostMissing || result?.forbidden) {
    setStatus("The AirDrop helper needs to be set up; see the setup page.", "error");
  } else {
    setStatus(result?.error ?? "Something went wrong.", "error");
  }
  button.disabled = false;
  input.focus();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") window.close();
});

update();
input.focus();
