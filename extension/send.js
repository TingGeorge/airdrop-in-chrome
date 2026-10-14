import { findUrlInText, parseUserUrl } from "./native.js";

const form = document.getElementById("form");
const input = document.getElementById("url");
const button = document.getElementById("send");
const status = document.getElementById("status");

const HINT = "Paste with ⌘V, then press Return.";
const NOT_A_LINK = "That isn't a web link (http or https).";
let sending = false;

// window.close() isn't guaranteed for windows created by chrome.windows.create.
function closeWindow() {
  chrome.windows.getCurrent().then((w) => chrome.windows.remove(w.id)).catch(() => window.close());
}

function setStatus(text, state = "") {
  status.textContent = text;
  status.className = `status ${state}`;
  input.setAttribute("aria-invalid", String(state === "error"));
}

// While typing, stay neutral; errors only appear on submit or when leaving the field.
function update({ showErrors = false } = {}) {
  if (sending) return;
  const text = input.value.trim();
  const url = parseUserUrl(text);
  button.disabled = !text;
  if (!text) {
    setStatus(HINT);
  } else if (url) {
    setStatus(`Will send ${new URL(url).host}`);
  } else if (showErrors) {
    setStatus(NOT_A_LINK, "error");
  } else {
    setStatus(HINT);
  }
}

input.addEventListener("input", () => update());
input.addEventListener("blur", () => update({ showErrors: true }));

// A pasted chat message or a multi-line block would otherwise be flattened into one
// bogus URL, because text inputs drop newlines. Keep just the first link in it.
input.addEventListener("paste", (event) => {
  if (input.readOnly) return; // sending; keep showing the link that was sent
  const pasted = event.clipboardData?.getData("text/plain") ?? "";
  if (!/\s/.test(pasted.trim())) return; // a plain single link: let the browser paste it
  event.preventDefault();
  const url = findUrlInText(pasted);
  input.value = url ?? pasted.replace(/\s+/g, " ").trim();
  update({ showErrors: true });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (sending) return;
  const url = parseUserUrl(input.value);
  if (!url) {
    update({ showErrors: true });
    input.focus();
    return;
  }

  sending = true;
  input.value = url;
  input.readOnly = true;
  button.disabled = true;
  setStatus("Opening AirDrop…");

  let result;
  try {
    result = await chrome.runtime.sendMessage({ type: "share-link", url });
  } catch {
    result = { ok: false, error: "Lost contact with the extension. Try again." };
  }

  if (result?.ok) {
    // Stay locked so a second Return can't send it again before the window closes.
    setStatus("Sent ✓", "ok");
    setTimeout(closeWindow, 1200);
    return;
  }

  sending = false;
  input.readOnly = false;
  button.disabled = false;
  if (result?.cancelled) {
    setStatus("Cancelled. Press Return to try again.");
  } else if (result?.hostMissing || result?.forbidden) {
    setStatus("The AirDrop helper needs to be set up; see the setup page.", "error");
  } else {
    setStatus(result?.error ?? "Something went wrong.", "error");
  }
  input.focus();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !event.isComposing) closeWindow();
});

update();
input.focus();
