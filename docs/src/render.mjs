// Renders the README images: node docs/src/render.mjs
// Needs Playwright (npm i -g playwright) and a Chromium build.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Resolve playwright from a local or global install (ESM ignores NODE_PATH).
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve("playwright", { paths: [process.cwd(), ...(process.env.NODE_PATH ?? "").split(":")] }));

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "..", "images");
const pages = [
  // JPEG: these are gradient-heavy, which PNG palettes band and full PNGs bloat.
  { src: "banner.html", out: "banner.jpg", width: 1280, height: 420 },
  { src: "demo.html", out: "demo.jpg", width: 1280, height: 780 },
];

const browser = await chromium.launch();
for (const p of pages) {
  const page = await browser.newPage({ viewport: { width: p.width, height: p.height }, deviceScaleFactor: 2 });
  await page.goto("file://" + path.join(here, p.src));
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(out, p.out), type: "jpeg", quality: 88 });
  await page.close();
  console.log("wrote", p.out);
}
await browser.close();
