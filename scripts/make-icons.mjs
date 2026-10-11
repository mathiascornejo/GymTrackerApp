// Renders the PWA icons from one SVG using the Chromium that Playwright already installed.
import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0A5CFF"/>
  <g transform="translate(256 256) scale(${1 - pad}) translate(-256 -256)" stroke="#fff" stroke-width="36" stroke-linecap="round" fill="none">
    <path d="M96 256h320M140 176v160M372 176v160M64 216v80M448 216v80"/>
  </g>
</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
const out = [
  ["public/icons/icon-192.png", 192, 0],
  ["public/icons/icon-512.png", 512, 0],
  ["public/icons/maskable-512.png", 512, 0.28], // safe zone: content inside the central 80%
  ["public/icons/apple-touch-icon.png", 180, 0],
];
for (const [path, size, pad] of out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0">${svg(pad).replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body>`);
  await writeFile(path, await page.screenshot({ type: "png" }));
}
await browser.close();
console.log("icons written");
