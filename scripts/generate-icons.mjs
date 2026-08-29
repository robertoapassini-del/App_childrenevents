import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

/**
 * Regenerates the PWA icons in public/.
 *
 *   node scripts/generate-icons.mjs
 *
 * Rendered through Chromium rather than an image library, so the project needs
 * no extra dependency for something that changes about once a year. Set
 * PLAYWRIGHT_CHROMIUM_PATH to use a Chromium the environment already provides.
 *
 * The mark is the marmoset the app is named after. A map-pin tail behind the
 * face was tried and dropped: at icon size it read as a pointed beard.
 */

const face = (scale = 1) => `
  <g transform="translate(256 236) scale(${scale}) translate(-256 -236)">
    <circle cx="150" cy="205" r="52" fill="#fff1dd"/>
    <circle cx="362" cy="205" r="52" fill="#fff1dd"/>
    <circle cx="150" cy="205" r="26" fill="#e0b183"/>
    <circle cx="362" cy="205" r="26" fill="#e0b183"/>
    <ellipse cx="256" cy="212" rx="120" ry="112" fill="#fff8f0"/>
    <ellipse cx="216" cy="196" rx="19" ry="23" fill="#2a1f1a"/>
    <ellipse cx="296" cy="196" rx="19" ry="23" fill="#2a1f1a"/>
    <circle cx="222" cy="188" r="6" fill="#fff8f0"/>
    <circle cx="302" cy="188" r="6" fill="#fff8f0"/>
    <ellipse cx="256" cy="258" rx="46" ry="34" fill="#ffe4c2"/>
    <ellipse cx="256" cy="243" rx="11" ry="8" fill="#2a1f1a"/>
    <path d="M238 266 q18 16 36 0" stroke="#2a1f1a" stroke-width="9"
          stroke-linecap="round" fill="none"/>
  </g>`;

/** Maskable icons lose their corners to the platform's mask, so inset the face. */
const svg = ({ maskable }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffb75a"/>
      <stop offset="1" stop-color="#f2820d"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" ${maskable ? "" : 'rx="112"'} fill="url(#bg)"/>
  ${face(maskable ? 0.68 : 1.08)}
</svg>`;

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  args: process.env.PLAYWRIGHT_CHROMIUM_PATH ? ["--no-sandbox"] : [],
});

async function render(name, size, maskable) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<style>html,body{margin:0;padding:0}svg{width:${size}px;height:${size}px;display:block}</style>${svg({ maskable })}`,
  );
  writeFileSync(`public/${name}`, await page.screenshot({ omitBackground: true }));
  console.log("wrote public/" + name);
  await page.close();
}

await render("icon-192.png", 192, false);
await render("icon-512.png", 512, false);
await render("icon-maskable-512.png", 512, true);
await render("apple-touch-icon.png", 180, false);

// The favicon stays SVG so it is sharp at any size.
writeFileSync("public/icon.svg", svg({ maskable: false }).trim() + "\n");
console.log("wrote public/icon.svg");

await browser.close();
