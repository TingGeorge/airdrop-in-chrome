// Renders extension/icons/*.png from the SVG sources here: node docs/src/icon/render-icons.mjs
// 16 px uses a simplified glyph (icon-16.svg) so it stays legible in the toolbar.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve("playwright", { paths: [process.cwd(), ...(process.env.NODE_PATH ?? "").split(":")] }));

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "..", "..", "..", "extension", "icons");
const targets = [
  { svg: "icon-16.svg", size: 16 },
  { svg: "icon.svg", size: 32 },
  { svg: "icon.svg", size: 48 },
  { svg: "icon.svg", size: 128 },
];

const browser = await chromium.launch();
for (const { svg, size } of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const markup = fs.readFileSync(path.join(here, svg), "utf8");
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${markup}`,
  );
  await page.screenshot({ path: path.join(out, `icon${size}.png`), omitBackground: true });
  await page.close();
  console.log(`wrote icon${size}.png`);
}
await browser.close();
