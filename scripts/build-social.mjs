// Generates the social share card (og.png) and the iOS home-screen icon
// (apple-touch-icon.png) from SVG sources, so both are checked in as real
// rasters — link previews and iOS icons do not accept SVG.
//
// Run: node scripts/build-social.mjs
//
// The card is deliberately typographic rather than a screenshot: a screenshot
// of a dark, fog-heavy 3D scene compresses badly and reads as a black
// rectangle in a feed. Replace og.png with a real hero frame if a good one
// exists — the meta tags in index.html already point here.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public');

const NIGHT = '#050607';
const BONE = '#d8d3c8';
const BLOOD = '#c1170f';

const card = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="moon" cx="50%" cy="78%" r="62%">
      <stop offset="0%" stop-color="#2a3550"/>
      <stop offset="55%" stop-color="#121a29"/>
      <stop offset="100%" stop-color="${NIGHT}"/>
    </radialGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${NIGHT}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${NIGHT}" stop-opacity="0.92"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#moon)"/>

  <!-- A treeline, a chapel and its lit doorway, as flat silhouettes: enough
       to read as the scene without pretending to be a render of it. Every
       shape sits BELOW the type block — an earlier pass ran the steeple
       straight through the wordmark. Lighter than instinct suggests, because
       a silhouette darker than its own backdrop simply disappears. -->
  <g fill="#0e1626">
    <path d="M40 512 L100 424 L160 512 Z"/>
    <path d="M150 512 L210 440 L270 512 Z"/>
    <path d="M930 512 L990 432 L1050 512 Z"/>
    <path d="M1040 512 L1100 448 L1160 512 Z"/>
    <path d="M540 512 L540 452 L600 402 L660 452 L660 512 Z"/>
    <rect x="593" y="352" width="14" height="56"/>
    <rect x="576" y="374" width="48" height="12"/>
    <rect x="0" y="510" width="1200" height="120"/>
  </g>
  <!-- Red spill from the chapel doorway: the site's one colour accent. -->
  <rect x="586" y="474" width="28" height="38" fill="${BLOOD}" fill-opacity="0.55"/>

  <rect width="1200" height="630" fill="url(#fade)"/>

  <text x="600" y="268" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif"
        font-size="164" fill="${BONE}" letter-spacing="10">fish</text>
  <text x="600" y="322" text-anchor="middle" font-family="'Courier New', monospace"
        font-size="24" fill="${BONE}" fill-opacity="0.75" letter-spacing="13">P R O D F I S H</text>
  <rect x="520" y="350" width="160" height="2" fill="${BLOOD}"/>
  <text x="600" y="586" text-anchor="middle" font-family="'Courier New', monospace"
        font-size="21" fill="${BONE}" fill-opacity="0.65" letter-spacing="7">beats from the dark south</text>
</svg>`;

const icon = `
<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="${NIGHT}"/>
  <g fill="${BLOOD}">
    <path d="M44 32c0 6.5-7.6 13-17 13S10 38.5 10 32s7.6-13 17-13 17 6.5 17 13z"/>
    <path d="M45 32l9-9v18l-9-9z"/>
  </g>
  <circle cx="20" cy="28.5" r="2.2" fill="${BONE}"/>
</svg>`;

async function render(svg, file, width) {
  const png = await sharp(Buffer.from(svg)).resize({ width }).png().toBuffer();
  writeFileSync(join(out, file), png);
  console.log(`wrote public/${file} (${(png.length / 1024).toFixed(1)}KB)`);
}

await render(card, 'og.png', 1200);
await render(icon, 'apple-touch-icon.png', 180);
