# prodfish Southern Gothic Scroll Site — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single-page scroll experience: night exterior of an old church (2.5D depth-displaced photo planes) that the camera dollies into on scroll, blacking out through the doorway and revealing a red chapel interior with the BeatStars embed.

**Architecture:** Fixed fullscreen Three.js canvas renders three depth-displaced photo planes (exterior / threshold / interior) along one camera axis. A tall DOM scroll track drives a single GSAP ScrollTrigger timeline that tweens a shared `state` object (camera z, plane opacities, fog, glow) plus DOM overlays. Lenis provides smooth scroll. Procedural canvas placeholders stand in for AI images; real images drop into `public/scenes/` with zero code changes.

**Tech Stack:** Vite (vanilla JS), Three.js, GSAP + ScrollTrigger, Lenis, Vitest.

## Global Constraints

- Artist name everywhere: **prodfish** (lowercase).
- No JS framework. Static Vite build output, deployable to Vercel.
- Pixel ratio capped at 2 (1.5 on low tier). Single RAF loop (GSAP ticker drives Lenis and Three render).
- BeatStars embed URL and social links are placeholders: `https://player.beatstars.com/?storeId=PLACEHOLDER`, hrefs `#`. Contact placeholder `beats@prodfish.com`.
- `prefers-reduced-motion: reduce` → static composed page, no scroll-driven camera or ambient motion.
- No WebGL → CSS-only fallback; embed and content remain fully usable.
- Real scene images live at `public/scenes/{exterior,threshold,interior}.jpg` (+ optional `-depth.jpg`); code falls back to procedural placeholders when absent.

---

## File Structure

```
index.html                 — DOM: canvas, overlays (hero/glow/blackout), scroll track, chapel section
package.json               — scripts: dev / build / preview / test
src/style.css              — layout, typography, overlay + chapel styling, fallback modes
src/main.js                — boot: capability checks, init scroll/scene/timeline
src/device.js              — device tier heuristic + tier settings (pure, tested)
src/choreography.js        — ACT boundaries + shared animation state (pure, tested)
src/scroll.js              — Lenis ↔ GSAP ScrollTrigger wiring
src/timeline.js            — master scrubbed timeline
src/scenes/placeholders.js — procedural canvas scene art + depth maps
src/scenes/depthPlane.js   — depth-displaced plane (custom ShaderMaterial)
src/scenes/particles.js    — firefly points
src/scenes/post.js         — grain / vignette / chromatic aberration pass
src/scenes/loader.js       — real-image-or-placeholder texture resolver
src/scenes/sceneManager.js — renderer, camera, scene graph, render loop
assets/PROMPTS.md          — AI image generation prompts
public/scenes/README.md    — where to drop generated images
tests/device.test.js
tests/choreography.test.js
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `index.html`, `src/style.css`, `src/main.js`, `.gitignore`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `preview`, `test`; DOM ids `#scene`, `#glow`, `#blackout`, `#hero`, `#scroll-track`, `#chapel` that all later tasks rely on.

- [ ] **Step 1: Create package.json and install dependencies**

```json
{
  "name": "prodfish",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  }
}
```

Run: `npm i three gsap lenis && npm i -D vite vitest`

- [ ] **Step 2: Create .gitignore**

```
node_modules
dist
.vercel
.DS_Store
```

- [ ] **Step 3: Create index.html**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>prodfish — beats</title>
  <meta name="description" content="prodfish. beats from the dark south." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=IBM+Plex+Mono:wght@300;400&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/src/style.css" />
</head>
<body>
  <canvas id="scene"></canvas>
  <div id="glow" aria-hidden="true"></div>
  <div id="blackout" aria-hidden="true"></div>

  <header id="hero">
    <h1>prodfish</h1>
    <p class="hint">scroll<span class="hint-arrow">▾</span></p>
  </header>

  <main id="scroll-track">
    <section id="chapel">
      <!-- chapel content added in Task 8 -->
    </section>
  </main>

  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Create src/style.css (base layout only; chapel/fallback styles come later)**

```css
:root {
  --bone: #d8d3c8;
  --blood: #c1170f;
  --blood-dim: #5a0a06;
  --night: #050607;
  --serif: "Cormorant Garamond", serif;
  --mono: "IBM Plex Mono", monospace;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

html { background: var(--night); }
body {
  background: var(--night);
  color: var(--bone);
  font-family: var(--mono);
  overflow-x: hidden;
}

#scene {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

#glow {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(ellipse 40% 55% at 50% 62%,
    rgba(193, 23, 15, 0.55), rgba(193, 23, 15, 0.12) 55%, transparent 75%);
}

#blackout {
  position: fixed;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: #000;
  opacity: 1;
}

#hero {
  position: fixed;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2.5rem;
  pointer-events: none;
  text-align: center;
}
#hero h1 {
  font-family: var(--serif);
  font-weight: 400;
  font-size: clamp(3rem, 9vw, 7rem);
  letter-spacing: 0.35em;
  margin-left: 0.35em; /* optically recenter tracked text */
  color: var(--bone);
  text-shadow: 0 0 40px rgba(216, 211, 200, 0.25);
}
#hero .hint {
  font-size: 0.75rem;
  letter-spacing: 0.5em;
  text-transform: uppercase;
  opacity: 0.55;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}
.hint-arrow { animation: sink 2.4s ease-in-out infinite; }
@keyframes sink {
  0%, 100% { transform: translateY(0); opacity: 0.4; }
  50% { transform: translateY(6px); opacity: 1; }
}

#scroll-track {
  position: relative;
  height: 600vh;
  z-index: 4;
}

#chapel {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  padding: 4rem 1.5rem;
}
```

- [ ] **Step 5: Create src/main.js (boot stub)**

```js
console.log('prodfish: boot');
```

- [ ] **Step 6: Verify build and dev server**

Run: `npm run build`
Expected: vite build succeeds, `dist/` produced.
Run: `npx vitest run --passWithNoTests`
Expected: passes (no tests yet).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold vite project with base DOM and styles"
```

---

### Task 2: Device tier heuristic

**Files:**
- Create: `src/device.js`
- Test: `tests/device.test.js`

**Interfaces:**
- Produces: `deviceTier(info) -> 'low'|'high'`, `TIERS[tier] -> { segments, particles, dprCap }`, `detectTier() -> tier` (reads real browser values; untested wrapper).

- [ ] **Step 1: Write failing tests**

```js
// tests/device.test.js
import { describe, it, expect } from 'vitest';
import { deviceTier, TIERS } from '../src/device.js';

describe('deviceTier', () => {
  it('classifies mobile UA as low', () => {
    expect(deviceTier({ isMobileUA: true, memory: 8, cores: 8 })).toBe('low');
  });
  it('classifies low memory as low', () => {
    expect(deviceTier({ isMobileUA: false, memory: 4, cores: 8 })).toBe('low');
  });
  it('classifies few cores as low', () => {
    expect(deviceTier({ isMobileUA: false, memory: 16, cores: 4 })).toBe('low');
  });
  it('classifies desktop as high', () => {
    expect(deviceTier({ isMobileUA: false, memory: 16, cores: 10 })).toBe('high');
  });
  it('treats missing memory/cores as high signals absent (not low)', () => {
    expect(deviceTier({ isMobileUA: false })).toBe('high');
  });
});

describe('TIERS', () => {
  it('has settings for both tiers', () => {
    for (const t of ['low', 'high']) {
      expect(TIERS[t].segments).toBeGreaterThan(0);
      expect(TIERS[t].particles).toBeGreaterThan(0);
      expect(TIERS[t].dprCap).toBeGreaterThan(0);
    }
  });
  it('low tier is lighter than high tier', () => {
    expect(TIERS.low.segments).toBeLessThan(TIERS.high.segments);
    expect(TIERS.low.particles).toBeLessThan(TIERS.high.particles);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/device.test.js`
Expected: FAIL — cannot resolve `../src/device.js`.

- [ ] **Step 3: Implement src/device.js**

```js
export const TIERS = {
  low: { segments: 64, particles: 60, dprCap: 1.5 },
  high: { segments: 160, particles: 140, dprCap: 2 },
};

export function deviceTier({ isMobileUA = false, memory, cores } = {}) {
  if (isMobileUA) return 'low';
  if (memory !== undefined && memory <= 4) return 'low';
  if (cores !== undefined && cores <= 4) return 'low';
  return 'high';
}

export function detectTier() {
  return deviceTier({
    isMobileUA: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent),
    memory: navigator.deviceMemory,
    cores: navigator.hardwareConcurrency,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/device.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/device.js tests/device.test.js
git commit -m "feat: device tier heuristic with tier settings"
```

---

### Task 3: Choreography state and act boundaries

**Files:**
- Create: `src/choreography.js`
- Test: `tests/choreography.test.js`

**Interfaces:**
- Produces: `ACTS` (named `[start, end]` scroll-progress spans), `createState() -> state` object with the exact keys the scene manager reads every frame and the timeline tweens: `camZ, camY, swayAmp, exteriorOpacity, thresholdOpacity, interiorOpacity, fog, fireflies`.

- [ ] **Step 1: Write failing tests**

```js
// tests/choreography.test.js
import { describe, it, expect } from 'vitest';
import { ACTS, createState } from '../src/choreography.js';

describe('ACTS', () => {
  const order = ['arrival', 'approach', 'threshold', 'chapel', 'beats'];
  it('has the five acts in order', () => {
    expect(Object.keys(ACTS)).toEqual(order);
  });
  it('spans are contiguous from 0 to 1', () => {
    let cursor = 0;
    for (const name of order) {
      const [start, end] = ACTS[name];
      expect(start).toBeCloseTo(cursor, 5);
      expect(end).toBeGreaterThan(start);
      cursor = end;
    }
    expect(cursor).toBeCloseTo(1, 5);
  });
});

describe('createState', () => {
  it('starts before the scene: camera far, everything dark', () => {
    const s = createState();
    expect(s.camZ).toBe(14);
    expect(s.exteriorOpacity).toBe(0);
    expect(s.thresholdOpacity).toBe(0);
    expect(s.interiorOpacity).toBe(0);
  });
  it('returns independent objects', () => {
    const a = createState();
    const b = createState();
    a.camZ = 0;
    expect(b.camZ).toBe(14);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/choreography.test.js`
Expected: FAIL — cannot resolve `../src/choreography.js`.

- [ ] **Step 3: Implement src/choreography.js**

```js
// Scroll progress spans (0..1) for the five acts of the experience.
export const ACTS = {
  arrival:   [0.00, 0.15], // black -> title -> exterior emerges
  approach:  [0.15, 0.45], // dolly through the grass toward the church
  threshold: [0.45, 0.62], // door closeup, red glow, blackout
  chapel:    [0.62, 0.82], // red interior fades in, drift down the aisle
  beats:     [0.82, 1.00], // beatstars altar + socials (in-flow DOM)
};

// Shared animation state. The timeline tweens this; the scene manager
// reads it every frame. DOM overlays are tweened directly by GSAP.
export function createState() {
  return {
    camZ: 14,
    camY: 0,
    swayAmp: 1,          // ambient camera sway multiplier
    exteriorOpacity: 0,
    thresholdOpacity: 0,
    interiorOpacity: 0,
    fog: 0.15,           // fog mix on the exterior plane
    fireflies: 0,        // firefly particle opacity
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS (all device + choreography tests).

- [ ] **Step 5: Commit**

```bash
git add src/choreography.js tests/choreography.test.js
git commit -m "feat: act boundaries and shared animation state"
```

---

### Task 4: Procedural placeholder scenes

**Files:**
- Create: `src/scenes/placeholders.js`

**Interfaces:**
- Produces: `makeExterior() / makeThreshold() / makeInterior()`, each returning `{ color: HTMLCanvasElement, depth: HTMLCanvasElement }` (1024×1024). Task 5/10 consume these canvases as textures.

- [ ] **Step 1: Implement src/scenes/placeholders.js**

```js
const SIZE = 1024;

function canvas() {
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  return c;
}

function grain(ctx, alpha) {
  // cheap film grain: scattered translucent pixels
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i = 0; i < 14000; i++) {
    const v = Math.random() * 255;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(Math.random() * SIZE, Math.random() * SIZE, 1, 1);
  }
  ctx.restore();
}

// ---------- EXTERIOR: pale church, dark woods, man in the grass ----------
export function makeExterior() {
  const color = canvas();
  const ctx = color.getContext('2d');

  // night sky
  const sky = ctx.createLinearGradient(0, 0, 0, SIZE);
  sky.addColorStop(0, '#04060a');
  sky.addColorStop(0.55, '#0a0d12');
  sky.addColorStop(1, '#10130f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // tree masses left/right
  ctx.fillStyle = '#070a06';
  for (const [cx, w] of [[80, 340], [944, 340], [200, 240], [860, 260]]) {
    ctx.beginPath();
    ctx.ellipse(cx, 330, w / 2, 330, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // church: flash-lit pale facade
  const churchX = SIZE / 2;
  ctx.fillStyle = '#b9b2a2';
  ctx.fillRect(churchX - 150, 400, 300, 320);            // body
  ctx.beginPath();                                        // gable
  ctx.moveTo(churchX - 170, 400);
  ctx.lineTo(churchX, 260);
  ctx.lineTo(churchX + 170, 400);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c4bdae';
  ctx.fillRect(churchX + 90, 250, 90, 470);              // tower
  ctx.beginPath();                                        // steeple
  ctx.moveTo(churchX + 80, 250);
  ctx.lineTo(churchX + 135, 150);
  ctx.lineTo(churchX + 190, 250);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#3a352c';                            // cross on tower
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(churchX + 135, 300);
  ctx.lineTo(churchX + 135, 360);
  ctx.moveTo(churchX + 115, 320);
  ctx.lineTo(churchX + 155, 320);
  ctx.stroke();

  // dark door (the destination)
  ctx.fillStyle = '#141210';
  ctx.beginPath();
  ctx.moveTo(churchX - 40, 720);
  ctx.lineTo(churchX - 40, 590);
  ctx.quadraticCurveTo(churchX, 545, churchX + 40, 590);
  ctx.lineTo(churchX + 40, 720);
  ctx.closePath();
  ctx.fill();

  // window slits
  ctx.fillStyle = '#241f19';
  ctx.fillRect(churchX - 110, 480, 30, 90);
  ctx.fillRect(churchX + 80, 480, 30, 90);

  // grass field
  const grass = ctx.createLinearGradient(0, 700, 0, SIZE);
  grass.addColorStop(0, '#131a0d');
  grass.addColorStop(1, '#2a3618');
  ctx.fillStyle = grass;
  ctx.fillRect(0, 700, SIZE, SIZE - 700);
  ctx.strokeStyle = 'rgba(70, 90, 40, 0.5)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * SIZE;
    const y = 700 + Math.random() * (SIZE - 700);
    const h = 8 + Math.random() * 26 * ((y - 660) / (SIZE - 660));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() * 8 - 4), y - h);
    ctx.stroke();
  }

  // the man: small dark silhouette in the grass
  ctx.fillStyle = '#0b0a09';
  ctx.beginPath();
  ctx.ellipse(churchX, 764, 5, 6, 0, 0, Math.PI * 2);     // head
  ctx.fill();
  ctx.fillRect(churchX - 9, 770, 18, 46);                 // coat
  ctx.fillRect(churchX - 7, 816, 5, 26);                  // legs
  ctx.fillRect(churchX + 2, 816, 5, 26);

  grain(ctx, 0.05);

  // depth map: white = near
  const depth = canvas();
  const dctx = depth.getContext('2d');
  const dg = dctx.createLinearGradient(0, 0, 0, SIZE);
  dg.addColorStop(0, '#000');    // sky: far
  dg.addColorStop(0.68, '#1a1a1a');
  dg.addColorStop(0.72, '#555'); // grass starts
  dg.addColorStop(1, '#fff');    // foreground grass: near
  dctx.fillStyle = dg;
  dctx.fillRect(0, 0, SIZE, SIZE);
  dctx.fillStyle = '#333';       // church slab sits mid-depth
  dctx.fillRect(churchX - 190, 150, 380, 570);
  dctx.fillStyle = '#777';       // the man is nearer than the church
  dctx.fillRect(churchX - 12, 755, 24, 90);

  return { color, depth };
}

// ---------- THRESHOLD: door closeup, red light leaking ----------
export function makeThreshold() {
  const color = canvas();
  const ctx = color.getContext('2d');

  ctx.fillStyle = '#0c0b09';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // weathered boards
  ctx.strokeStyle = 'rgba(160, 150, 130, 0.16)';
  ctx.lineWidth = 3;
  for (let y = 0; y < SIZE; y += 34) {
    ctx.beginPath();
    ctx.moveTo(0, y + Math.random() * 6);
    ctx.lineTo(SIZE, y + Math.random() * 6);
    ctx.stroke();
  }

  // pale doorframe
  ctx.fillStyle = '#8d8677';
  ctx.fillRect(300, 140, 60, 750);
  ctx.fillRect(664, 140, 60, 750);
  ctx.beginPath();
  ctx.moveTo(300, 170);
  ctx.quadraticCurveTo(512, 20, 724, 170);
  ctx.lineTo(724, 240);
  ctx.quadraticCurveTo(512, 100, 300, 240);
  ctx.closePath();
  ctx.fill();

  // door, ajar with red slit
  ctx.fillStyle = '#17130f';
  ctx.fillRect(360, 190, 304, 700);
  const slit = ctx.createLinearGradient(596, 0, 664, 0);
  slit.addColorStop(0, 'rgba(120, 8, 4, 0)');
  slit.addColorStop(1, '#c1170f');
  ctx.fillStyle = slit;
  ctx.fillRect(596, 200, 68, 690);
  ctx.save();                                   // red bloom
  ctx.filter = 'blur(40px)';
  ctx.fillStyle = 'rgba(193, 23, 15, 0.5)';
  ctx.fillRect(600, 180, 120, 720);
  ctx.restore();

  grain(ctx, 0.06);

  const depth = canvas();
  const dctx = depth.getContext('2d');
  dctx.fillStyle = '#222';                      // wall
  dctx.fillRect(0, 0, SIZE, SIZE);
  dctx.fillStyle = '#888';                      // frame near
  dctx.fillRect(300, 140, 60, 750);
  dctx.fillRect(664, 140, 60, 750);
  dctx.fillStyle = '#000';                      // doorway recess: far
  dctx.fillRect(360, 190, 304, 700);

  return { color, depth };
}

// ---------- INTERIOR: red chapel, neon cross, pews ----------
export function makeInterior() {
  const color = canvas();
  const ctx = color.getContext('2d');

  // deep red room
  const room = ctx.createRadialGradient(512, 430, 60, 512, 520, 780);
  room.addColorStop(0, '#4a0703');
  room.addColorStop(0.5, '#2b0402');
  room.addColorStop(1, '#0d0100');
  ctx.fillStyle = room;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // altar wall panel
  ctx.fillStyle = 'rgba(90, 10, 6, 0.55)';
  ctx.fillRect(312, 190, 400, 470);

  // neon cross
  ctx.save();
  ctx.shadowColor = '#ff2a1a';
  ctx.shadowBlur = 60;
  ctx.fillStyle = '#ffd9a8';
  ctx.fillRect(497, 260, 30, 240);
  ctx.fillRect(432, 322, 160, 30);
  ctx.restore();
  ctx.save();
  ctx.filter = 'blur(60px)';
  ctx.fillStyle = 'rgba(255, 42, 26, 0.35)';
  ctx.fillRect(380, 220, 260, 320);
  ctx.restore();

  // altar platform + steps
  ctx.fillStyle = '#320503';
  ctx.fillRect(240, 640, 544, 60);
  ctx.fillStyle = '#200302';
  ctx.fillRect(200, 700, 624, 40);

  // pew silhouettes, perspective-larger toward viewer
  ctx.fillStyle = '#0a0100';
  for (let i = 0; i < 4; i++) {
    const y = 760 + i * 66;
    const inset = 60 - i * 20;
    ctx.fillRect(inset, y, 380 - inset, 40 + i * 6);
    ctx.fillRect(SIZE - 380, y, 380 - inset, 40 + i * 6);
  }

  grain(ctx, 0.07);

  const depth = canvas();
  const dctx = depth.getContext('2d');
  const dg = dctx.createLinearGradient(0, 0, 0, SIZE);
  dg.addColorStop(0, '#111');   // ceiling/wall far
  dg.addColorStop(0.62, '#222');
  dg.addColorStop(1, '#eee');   // floor/pews near
  dctx.fillStyle = dg;
  dctx.fillRect(0, 0, SIZE, SIZE);
  dctx.fillStyle = '#444';      // cross slightly proud of the wall
  dctx.fillRect(432, 260, 160, 240);

  return { color, depth };
}
```

- [ ] **Step 2: Add a debug view to main.js to eyeball the placeholders**

Replace `src/main.js` contents:

```js
import { makeExterior, makeThreshold, makeInterior } from './scenes/placeholders.js';

if (new URLSearchParams(location.search).has('debug')) {
  document.body.style.overflow = 'auto';
  for (const make of [makeExterior, makeThreshold, makeInterior]) {
    const { color, depth } = make();
    for (const c of [color, depth]) {
      c.style.cssText = 'width:320px;height:320px;display:inline-block;margin:4px;position:relative;z-index:10';
      document.body.appendChild(c);
    }
  }
} else {
  console.log('prodfish: boot');
}
```

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`, open `http://localhost:5173/?debug`
Expected: six tiles — exterior (pale church, dark woods, grass, tiny figure) + its depth gradient; threshold (doorframe, red slit) + depth; interior (red room, glowing cross, pews) + depth. Adjust drawing constants if composition looks off.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/placeholders.js src/main.js
git commit -m "feat: procedural placeholder scene art with depth maps"
```

---

### Task 5: Scene manager and depth-displaced planes

**Files:**
- Create: `src/scenes/depthPlane.js`, `src/scenes/sceneManager.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `createState()` from choreography, `detectTier()/TIERS` from device, placeholder makers.
- Produces: `createDepthPlane({ colorTex, depthTex, size, segments, depthScale }) -> THREE.Mesh` with `mesh.material.uniforms.{uOpacity,uFog}`; `initScene({ canvas, state, tier }) -> { setTextures(name, colorTex, depthTex) }`. Scene layout contract: exterior plane at z=0, threshold at z=−12, interior at z=−40; camera reads `state.camZ/camY` each frame.

- [ ] **Step 1: Implement src/scenes/depthPlane.js**

```js
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  uniform sampler2D uDepth;
  uniform float uDepthScale;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float d = texture2D(uDepth, uv).r;
    p.z += d * uDepthScale;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform float uFog;
  uniform vec3 uFogColor;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uMap, vUv);
    c.rgb = mix(c.rgb, uFogColor, uFog);
    gl_FragColor = vec4(c.rgb, c.a * uOpacity);
    if (gl_FragColor.a < 0.003) discard;
  }
`;

export function createDepthPlane({ colorTex, depthTex, size = 16, segments = 128, depthScale = 2.5 }) {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  const mat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uMap: { value: colorTex },
      uDepth: { value: depthTex },
      uDepthScale: { value: depthScale },
      uOpacity: { value: 0 },
      uFog: { value: 0 },
      uFogColor: { value: new THREE.Color('#0a0d12') },
    },
  });
  return new THREE.Mesh(geo, mat);
}
```

- [ ] **Step 2: Implement src/scenes/sceneManager.js**

```js
import * as THREE from 'three';
import { createDepthPlane } from './depthPlane.js';
import { TIERS } from '../device.js';

export const PLANE_Z = { exterior: 0, threshold: -12, interior: -40 };

export function initScene({ canvas, state, tier }) {
  const settings = TIERS[tier];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  renderer.setClearColor('#000000', 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.dprCap));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, state.camZ);

  const planes = {};
  for (const name of Object.keys(PLANE_Z)) {
    const tex = new THREE.Texture(); // replaced via setTextures
    const plane = createDepthPlane({
      colorTex: tex,
      depthTex: tex,
      size: 16,
      segments: settings.segments,
      depthScale: name === 'interior' ? 3.5 : 2.5,
    });
    plane.position.z = PLANE_Z[name];
    scene.add(plane);
    planes[name] = plane;
  }

  function setTextures(name, colorTex, depthTex) {
    colorTex.colorSpace = THREE.SRGBColorSpace;
    const u = planes[name].material.uniforms;
    u.uMap.value = colorTex;
    u.uDepth.value = depthTex;
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();
  function render() {
    const t = clock.getElapsedTime();
    // ambient sway — the scene breathes even when idle
    camera.position.x = Math.sin(t * 0.28) * 0.14 * state.swayAmp;
    camera.position.y = state.camY + Math.sin(t * 0.19) * 0.08 * state.swayAmp;
    camera.position.z = state.camZ;
    camera.lookAt(0, camera.position.y * 0.5, state.camZ - 20);

    planes.exterior.material.uniforms.uOpacity.value = state.exteriorOpacity;
    planes.exterior.material.uniforms.uFog.value = state.fog;
    planes.threshold.material.uniforms.uOpacity.value = state.thresholdOpacity;
    planes.interior.material.uniforms.uOpacity.value = state.interiorOpacity;

    renderer.render(scene, camera);
  }

  return { renderer, scene, camera, planes, render, setTextures };
}
```

- [ ] **Step 3: Wire into src/main.js (keep debug branch)**

Replace `src/main.js`:

```js
import * as THREE from 'three';
import { gsap } from 'gsap';
import { createState } from './choreography.js';
import { detectTier } from './device.js';
import { initScene } from './scenes/sceneManager.js';
import { makeExterior, makeThreshold, makeInterior } from './scenes/placeholders.js';

function debugScenes() {
  document.body.style.overflow = 'auto';
  for (const make of [makeExterior, makeThreshold, makeInterior]) {
    const { color, depth } = make();
    for (const c of [color, depth]) {
      c.style.cssText = 'width:320px;height:320px;display:inline-block;margin:4px;position:relative;z-index:10';
      document.body.appendChild(c);
    }
  }
}

function boot() {
  const state = createState();
  const tier = detectTier();
  const app = initScene({ canvas: document.getElementById('scene'), state, tier });

  const sources = { exterior: makeExterior(), threshold: makeThreshold(), interior: makeInterior() };
  for (const [name, { color, depth }] of Object.entries(sources)) {
    app.setTextures(name, new THREE.CanvasTexture(color), new THREE.CanvasTexture(depth));
  }

  // temporary: show exterior immediately until the timeline exists (Task 7)
  state.exteriorOpacity = 1;
  document.getElementById('blackout').style.opacity = '0';

  gsap.ticker.add(() => app.render());
}

if (new URLSearchParams(location.search).has('debug')) debugScenes();
else boot();
```

- [ ] **Step 4: Verify in browser**

Run: `npm run dev`, open `http://localhost:5173/`
Expected: the placeholder exterior fills the screen with gentle camera sway; grass visibly parallaxes against the church/sky (depth displacement working). No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/depthPlane.js src/scenes/sceneManager.js src/main.js
git commit -m "feat: three.js scene manager with depth-displaced planes"
```

---

### Task 6: Fireflies and post-processing (grain / vignette / aberration)

**Files:**
- Create: `src/scenes/particles.js`, `src/scenes/post.js`
- Modify: `src/scenes/sceneManager.js`

**Interfaces:**
- Consumes: scene/renderer/camera from `initScene`, `TIERS[tier].particles`.
- Produces: `createFireflies(count) -> THREE.Points` with `material.uniforms.{uTime,uOpacity}`; `createPost(renderer, scene, camera) -> { composer, setTime(t), pass }`. Scene manager renders through the composer and drives firefly opacity from `state.fireflies`.

- [ ] **Step 1: Implement src/scenes/particles.js**

```js
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  attribute float aScale;
  attribute float aPhase;
  uniform float uTime;
  varying float vTwinkle;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.4 + aPhase * 6.28) * 0.6;
    p.y += sin(uTime * 0.27 + aPhase * 9.4) * 0.4;
    vTwinkle = 0.5 + 0.5 * sin(uTime * 1.6 + aPhase * 12.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = aScale * 42.0 / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  varying float vTwinkle;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float glow = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vec3(0.85, 0.9, 0.6), glow * vTwinkle * uOpacity);
  }
`;

export function createFireflies(count) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const scale = new Float32Array(count);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 14;      // x across the field
    pos[i * 3 + 1] = -4 + Math.random() * 4;      // y: grass height band
    pos[i * 3 + 2] = 1 + Math.random() * 9;       // z: between camera start and church
    scale[i] = 0.5 + Math.random();
    phase[i] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));

  const mat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
  });
  return new THREE.Points(geo, mat);
}
```

- [ ] **Step 2: Implement src/scenes/post.js**

```js
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const FilmShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.09 },
    uVignette: { value: 0.55 },
    uCA: { value: 0.0015 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrain;
    uniform float uVignette;
    uniform float uCA;
    varying vec2 vUv;
    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }
    void main() {
      vec2 off = (vUv - 0.5) * uCA;
      vec4 c;
      c.r = texture2D(tDiffuse, vUv - off).r;
      c.g = texture2D(tDiffuse, vUv).g;
      c.b = texture2D(tDiffuse, vUv + off).b;
      c.a = 1.0;
      float v = smoothstep(0.92, 0.25, length(vUv - 0.5));
      c.rgb *= mix(1.0, v, uVignette);
      c.rgb += (rand(vUv * (1.0 + fract(uTime))) - 0.5) * uGrain;
      gl_FragColor = c;
    }
  `,
};

export function createPost(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const pass = new ShaderPass(FilmShader);
  composer.addPass(pass);
  return {
    composer,
    pass,
    setTime(t) { pass.uniforms.uTime.value = t; },
  };
}
```

- [ ] **Step 3: Integrate into sceneManager.js**

Add imports at top of `src/scenes/sceneManager.js`:

```js
import { createFireflies } from './particles.js';
import { createPost } from './post.js';
```

Inside `initScene`, after the planes loop, add:

```js
  const fireflies = createFireflies(settings.particles);
  scene.add(fireflies);

  const post = createPost(renderer, scene, camera);
```

In the resize handler, after `renderer.setSize(...)` add:

```js
    post.composer.setSize(window.innerWidth, window.innerHeight);
```

In `render()`, replace `renderer.render(scene, camera);` with:

```js
    fireflies.material.uniforms.uTime.value = t;
    fireflies.material.uniforms.uOpacity.value = state.fireflies;
    post.setTime(t);
    post.composer.render();
```

- [ ] **Step 4: Temporarily set `state.fireflies = 1` in main.js boot (next to `state.exteriorOpacity = 1`) and verify in browser**

Run: `npm run dev`
Expected: exterior scene now has film grain shimmer, darkened corners (vignette), subtle color fringing at edges, and drifting/twinkling fireflies in the grass band. Frame rate smooth.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/particles.js src/scenes/post.js src/scenes/sceneManager.js src/main.js
git commit -m "feat: fireflies and film grain/vignette post-processing"
```

---

### Task 7: Smooth scroll and master timeline

**Files:**
- Create: `src/scroll.js`, `src/timeline.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `state` object, `ACTS` spans, DOM ids `#scroll-track`, `#hero`, `#glow`, `#blackout`.
- Produces: `initScroll() -> lenis`; `buildTimeline(state) -> gsap.core.Timeline` (scrubbed 0..1 against `#scroll-track`).

- [ ] **Step 1: Implement src/scroll.js**

```js
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initScroll() {
  gsap.registerPlugin(ScrollTrigger);
  const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}
```

- [ ] **Step 2: Implement src/timeline.js**

The timeline's positions/durations are expressed in the 0..1 progress space of the scroll track, matching `ACTS` in choreography.js.

```js
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ACTS } from './choreography.js';

export function buildTimeline(state) {
  gsap.registerPlugin(ScrollTrigger);

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '#scroll-track',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1.2,
    },
  });

  const [, arrivalEnd] = ACTS.arrival;
  const [approachStart, approachEnd] = ACTS.approach;
  const [thresholdStart, thresholdEnd] = ACTS.threshold;
  const [chapelStart, chapelEnd] = ACTS.chapel;

  // ACT 1 — ARRIVAL: scene emerges out of black behind the title
  tl.to(state, { exteriorOpacity: 1, fireflies: 1, duration: arrivalEnd * 0.8 }, 0.01)
    .to('#blackout', { opacity: 0, duration: arrivalEnd * 0.8 }, 0.01)
    .to('#hero', { opacity: 0, y: -70, duration: 0.08 }, arrivalEnd - 0.03);

  // ACT 2 — APPROACH: dolly through the grass, fog thickens
  tl.to(state, { camZ: 3, duration: approachEnd - approachStart, ease: 'power1.in' }, approachStart)
    .to(state, { fog: 0.32, duration: approachEnd - approachStart }, approachStart)
    .to(state, { swayAmp: 0.45, duration: approachEnd - approachStart }, approachStart);

  // ACT 3 — THRESHOLD: red glow leaks, cut to door closeup, blackout
  tl.to('#glow', { opacity: 1, duration: 0.08 }, thresholdStart)
    .to(state, { thresholdOpacity: 1, duration: 0.06 }, thresholdStart + 0.03)
    .to(state, { exteriorOpacity: 0, fireflies: 0, duration: 0.05 }, thresholdStart + 0.05)
    .to(state, { camZ: -5, duration: thresholdEnd - thresholdStart, ease: 'power1.in' }, thresholdStart)
    .to('#blackout', { opacity: 1, duration: 0.05 }, thresholdEnd - 0.06)
    .to('#glow', { opacity: 0, duration: 0.04 }, thresholdEnd - 0.05)
    .to(state, { thresholdOpacity: 0, duration: 0.02 }, thresholdEnd - 0.02);

  // hard cut while black: teleport camera to the chapel
  tl.set(state, { camZ: -26, camY: 0.4, swayAmp: 0.3 }, thresholdEnd);

  // ACT 4 — CHAPEL: red interior fades in, drift down the aisle
  tl.to(state, { interiorOpacity: 1, duration: 0.07 }, chapelStart + 0.01)
    .to('#blackout', { opacity: 0, duration: 0.07 }, chapelStart + 0.01)
    .to(state, { camZ: -30, camY: 0, duration: chapelEnd - chapelStart, ease: 'power1.out' }, chapelStart);

  // ACT 5 — BEATS: chapel section scrolls into view (in-flow DOM);
  // keep a slow residual drift so the scene never fully freezes
  tl.to(state, { camZ: -30.8, duration: 1 - chapelEnd }, chapelEnd);

  return tl;
}
```

- [ ] **Step 3: Rewrite the boot in src/main.js to use scroll + timeline**

Replace the `boot()` function:

```js
import { initScroll } from './scroll.js';
import { buildTimeline } from './timeline.js';
```

```js
function boot() {
  const state = createState();
  const tier = detectTier();
  const app = initScene({ canvas: document.getElementById('scene'), state, tier });

  const sources = { exterior: makeExterior(), threshold: makeThreshold(), interior: makeInterior() };
  for (const [name, { color, depth }] of Object.entries(sources)) {
    app.setTextures(name, new THREE.CanvasTexture(color), new THREE.CanvasTexture(depth));
  }

  initScroll();
  buildTimeline(state);
  gsap.ticker.add(() => app.render());
}
```

(Remove the temporary `state.exteriorOpacity = 1`, `state.fireflies = 1`, and blackout override lines.)

- [ ] **Step 4: Verify full choreography in browser**

Run: `npm run dev`
Expected, scrolling top to bottom:
1. Black + title → exterior fades in behind it, fireflies drifting.
2. Title lifts away; camera pushes forward; grass parallax; fog thickens.
3. Red glow blooms; door closeup crossfades in; screen falls to black.
4. Red chapel fades in, gentle drift down toward the cross.
5. Continued scroll reaches the (still empty) `#chapel` DOM section.
Scrolling back up reverses everything cleanly. No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/scroll.js src/timeline.js src/main.js
git commit -m "feat: lenis smooth scroll and master scrubbed timeline"
```

---

### Task 8: Chapel content — BeatStars embed, socials, contact

**Files:**
- Modify: `index.html` (fill `#chapel`), `src/style.css` (append chapel styles)

**Interfaces:**
- Consumes: `#chapel` section inside the scroll track.
- Produces: final page content; placeholder URLs per Global Constraints.

- [ ] **Step 1: Fill the #chapel section in index.html**

```html
    <section id="chapel">
      <h2 class="chapel-title">the beats</h2>
      <div class="altar-frame">
        <iframe
          src="https://player.beatstars.com/?storeId=PLACEHOLDER"
          title="prodfish beats on BeatStars"
          loading="lazy"
          allow="autoplay"
        ></iframe>
      </div>
      <a class="bs-link" href="https://www.beatstars.com/PLACEHOLDER" target="_blank" rel="noopener">
        open on beatstars ↗
      </a>
      <nav class="socials" aria-label="social links">
        <a href="#" aria-label="Instagram">instagram</a>
        <a href="#" aria-label="YouTube">youtube</a>
        <a href="#" aria-label="TikTok">tiktok</a>
      </nav>
      <p class="contact">
        custom work — <a href="mailto:beats@prodfish.com">beats@prodfish.com</a>
      </p>
      <footer class="chapel-footer">© prodfish. recorded after dark.</footer>
    </section>
```

- [ ] **Step 2: Append chapel styles to src/style.css**

```css
.chapel-title {
  font-family: var(--serif);
  font-weight: 400;
  font-style: italic;
  font-size: clamp(1.6rem, 4vw, 2.6rem);
  letter-spacing: 0.3em;
  margin-left: 0.3em;
  color: var(--bone);
  text-shadow: 0 0 30px rgba(193, 23, 15, 0.55);
}

.altar-frame {
  width: min(720px, 92vw);
  border: 1px solid rgba(193, 23, 15, 0.45);
  box-shadow:
    0 0 60px rgba(193, 23, 15, 0.22),
    inset 0 0 40px rgba(0, 0, 0, 0.7);
  background: rgba(5, 2, 1, 0.72);
  padding: 10px;
}
.altar-frame iframe {
  display: block;
  width: 100%;
  height: min(60vh, 560px);
  border: 0;
  background: #0a0302;
}

.bs-link {
  color: rgba(216, 211, 200, 0.6);
  font-size: 0.72rem;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  text-decoration: none;
  border-bottom: 1px solid rgba(193, 23, 15, 0.4);
  padding-bottom: 2px;
  transition: color 0.3s;
}
.bs-link:hover { color: var(--bone); }

.socials {
  display: flex;
  gap: 2.2rem;
  margin-top: 1rem;
}
.socials a {
  color: rgba(216, 211, 200, 0.55);
  font-size: 0.72rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  text-decoration: none;
  transition: color 0.3s, text-shadow 0.3s;
}
.socials a:hover {
  color: var(--bone);
  text-shadow: 0 0 16px rgba(193, 23, 15, 0.8);
}

.contact {
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  color: rgba(216, 211, 200, 0.5);
}
.contact a { color: rgba(216, 211, 200, 0.8); }

.chapel-footer {
  margin-top: 3rem;
  font-size: 0.65rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: rgba(216, 211, 200, 0.25);
}
```

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`, scroll to the end.
Expected: chapel content rises over the red interior — framed embed (BeatStars player loads or shows its own error for the placeholder id — frame + link still present), socials, contact, footer. Embed is clickable/scrollable. Text legible against the scene.

- [ ] **Step 4: Commit**

```bash
git add index.html src/style.css
git commit -m "feat: chapel section with beatstars embed, socials, contact"
```

---

### Task 9: Reduced-motion and no-WebGL fallbacks

**Files:**
- Modify: `src/main.js`, `src/style.css`

**Interfaces:**
- Consumes: everything built so far.
- Produces: body classes `reduced` and `no-webgl`; boot short-circuits accordingly.

- [ ] **Step 1: Add capability checks to src/main.js**

Add near the top:

```js
function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
```

Replace the bottom dispatch:

```js
if (new URLSearchParams(location.search).has('debug')) {
  debugScenes();
} else if (!webglAvailable()) {
  document.body.classList.add('no-webgl');
} else if (prefersReduced) {
  document.body.classList.add('reduced');
  bootStatic();
} else {
  boot();
}
```

Add `bootStatic` — renders one composed exterior frame, no scroll hijack, no ambient motion:

```js
function bootStatic() {
  const state = createState();
  state.camZ = 8;
  state.swayAmp = 0;
  state.exteriorOpacity = 1;
  state.fog = 0.25;
  const app = initScene({ canvas: document.getElementById('scene'), state, tier: 'low' });
  const sources = { exterior: makeExterior(), threshold: makeThreshold(), interior: makeInterior() };
  for (const [name, { color, depth }] of Object.entries(sources)) {
    app.setTextures(name, new THREE.CanvasTexture(color), new THREE.CanvasTexture(depth));
  }
  // render a few frames so textures upload, then stop
  let frames = 0;
  const tick = () => {
    app.render();
    if (++frames > 5) gsap.ticker.remove(tick);
  };
  gsap.ticker.add(tick);
}
```

- [ ] **Step 2: Add fallback styles to src/style.css**

```css
/* ---------- reduced motion: static composed page ---------- */
.reduced #blackout { opacity: 0; }
.reduced #hero { position: relative; height: 100vh; }
.reduced #scroll-track { height: auto; }
.reduced #chapel {
  position: relative;
  background: radial-gradient(ellipse at 50% 30%, #2b0402, #0d0100 75%);
}
.reduced .hint-arrow { animation: none; }

/* ---------- no webgl: css-only layered mood ---------- */
.no-webgl #scene { display: none; }
.no-webgl #blackout { opacity: 0; }
.no-webgl body, .no-webgl { background: var(--night); }
.no-webgl #hero {
  position: relative;
  height: 100vh;
  background:
    radial-gradient(ellipse 60% 40% at 50% 68%, rgba(185, 178, 162, 0.14), transparent 70%),
    linear-gradient(#04060a, #10130f);
}
.no-webgl #scroll-track { height: auto; }
.no-webgl #chapel {
  position: relative;
  background: radial-gradient(ellipse at 50% 30%, #2b0402, #0d0100 75%);
}
```

- [ ] **Step 3: Verify both modes**

Run: `npm run dev`
1. DevTools → Rendering → Emulate `prefers-reduced-motion: reduce` → reload. Expected: static hero over a still exterior frame, normal document scroll straight to chapel content on red gradient. No sway, no scrub.
2. DevTools → Rendering → disable WebGL (or temporarily return `false` from `webglAvailable`) → reload. Expected: gradient-backed hero and chapel, all content usable.

- [ ] **Step 4: Run full test suite and build**

Run: `npx vitest run && npm run build`
Expected: all tests pass, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/main.js src/style.css
git commit -m "feat: reduced-motion and no-webgl fallbacks"
```

---

### Task 10: Real-image loader, AI prompts, drop-in slots

**Files:**
- Create: `src/scenes/loader.js`, `assets/PROMPTS.md`, `public/scenes/README.md`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: placeholder makers.
- Produces: `loadSceneTextures(name, makePlaceholder) -> Promise<{ colorTex, depthTex }>` — tries `/scenes/{name}.jpg` and `/scenes/{name}-depth.jpg`, falls back per-file to the placeholder canvases.

- [ ] **Step 1: Implement src/scenes/loader.js**

```js
import * as THREE from 'three';

const loader = new THREE.TextureLoader();

function tryLoad(url) {
  return new Promise((resolve) => {
    loader.load(url, (tex) => resolve(tex), undefined, () => resolve(null));
  });
}

// Tries real images in /public/scenes; any missing file falls back to
// the procedural placeholder so partial drops still work.
export async function loadSceneTextures(name, makePlaceholder) {
  const [color, depth] = await Promise.all([
    tryLoad(`/scenes/${name}.jpg`),
    tryLoad(`/scenes/${name}-depth.jpg`),
  ]);
  let placeholder = null;
  const getPlaceholder = () => (placeholder ??= makePlaceholder());
  return {
    colorTex: color ?? new THREE.CanvasTexture(getPlaceholder().color),
    depthTex: depth ?? new THREE.CanvasTexture(getPlaceholder().depth),
  };
}
```

- [ ] **Step 2: Use the loader in main.js (both boot and bootStatic)**

Add import:

```js
import { loadSceneTextures } from './scenes/loader.js';
```

In `boot()` and `bootStatic()`, replace the `sources` block with:

```js
  const makers = { exterior: makeExterior, threshold: makeThreshold, interior: makeInterior };
  for (const [name, make] of Object.entries(makers)) {
    loadSceneTextures(name, make).then(({ colorTex, depthTex }) => {
      app.setTextures(name, colorTex, depthTex);
    });
  }
```

(Textures arrive async; planes are invisible until Act 1 anyway.)

- [ ] **Step 3: Create public/scenes/README.md**

```markdown
# Scene image slots

Drop AI-generated images here (2048×2048 JPG recommended):

- `exterior.jpg`  — church at night, man in the grass
- `threshold.jpg` — door closeup with red light leak
- `interior.jpg`  — red chapel with neon cross

Optional depth maps (grayscale, white = near, black = far):

- `exterior-depth.jpg`, `threshold-depth.jpg`, `interior-depth.jpg`

Any missing file falls back to the built-in placeholder art.
Prompts: see `assets/PROMPTS.md`.
```

- [ ] **Step 4: Create assets/PROMPTS.md**

```markdown
# AI image prompts — prodfish scenes

Generate at the highest resolution available, square (1:1). Aim for the same
"night flash photography" look across all three so they feel like one roll of
film. If your tool supports style references, feed it the inspiration shots.

## 1. exterior.jpg — the church and the man

> Night photograph shot on medium format film, direct flash. An abandoned
> white wooden country church with a small steeple stands at the edge of dark
> woods, walls pale and peeling, lit starkly by the flash against a near-black
> sky. Waist-high grass and weeds fill the foreground. A lone man in a long
> dark coat stands small and centered in the grass, far in front of the
> church, facing the camera. Spanish moss hangs from oak branches at the
> edges of the frame. Heavy film grain, muted desaturated palette, deep
> shadows, eerie stillness, southern gothic. No text, no watermark.

## 2. threshold.jpg — the door

> Night photograph, direct flash, medium format film. Extreme closeup of the
> weathered double door of an old white wooden church, paint peeling, boards
> cracked. The door is slightly ajar and an intense deep red light leaks
> through the gap and spills onto the doorframe. Everything outside the
> doorway falls into blackness. Heavy film grain, southern gothic horror
> stillness. No text, no watermark.

## 3. interior.jpg — the red chapel

> Interior photograph of a small chapel at night, bathed entirely in deep red
> light. A glowing neon cross mounted on the altar wall is the only light
> source, casting red glow across empty wooden pews and a wooden floor.
> Symmetrical composition facing the altar straight on, slight haze in the
> air, heavy film grain, ominous and reverent, southern gothic. No text, no
> watermark.

## Optional depth maps

If you can generate depth maps (e.g., Depth-Anything via any online demo),
export grayscale where white = near, black = far, and save as
`{name}-depth.jpg`. Otherwise skip — built-in approximations are used.
```

- [ ] **Step 5: Verify fallback + drop-in behavior**

Run: `npm run dev`
1. With no files in `public/scenes/`: site renders with placeholders as before (network tab shows 404s for `/scenes/*.jpg` — expected and handled).
2. Drop any test JPG in as `public/scenes/exterior.jpg`, reload: exterior plane shows the image with the placeholder depth map still displacing it.
3. Remove the test file.

- [ ] **Step 6: Commit**

```bash
git add src/scenes/loader.js src/main.js public/scenes/README.md assets/PROMPTS.md
git commit -m "feat: real-image drop-in loader with AI prompts"
```

---

### Task 11: Final polish, build verification, deploy notes

**Files:**
- Modify: `src/style.css` (mobile), `README.md` (create)

**Interfaces:**
- Consumes: the whole app.

- [ ] **Step 1: Mobile styling pass — append to src/style.css**

```css
@media (max-width: 640px) {
  #hero h1 { letter-spacing: 0.22em; margin-left: 0.22em; }
  .altar-frame iframe { height: 70vh; }
  .socials { gap: 1.4rem; flex-wrap: wrap; justify-content: center; }
  #chapel { padding: 3rem 1rem; }
}
```

- [ ] **Step 2: Create README.md**

```markdown
# prodfish

Southern gothic scroll site for beat producer **prodfish**.
Scroll from a night field, through the church door, into the red chapel
where the beats live.

## Stack
Vite · Three.js (depth-displaced photo planes) · GSAP ScrollTrigger · Lenis

## Develop
    npm install
    npm run dev

## Test / build
    npm test
    npm run build

## Swap in real imagery
Drop AI-generated scenes into `public/scenes/` — see
`public/scenes/README.md` and `assets/PROMPTS.md`.

## Before launch
- Replace `PLACEHOLDER` BeatStars store id in `index.html`
- Replace `#` social hrefs and the contact email

## Deploy
    npx vercel        # preview
    npx vercel --prod # production
```

- [ ] **Step 3: Full verification**

Run: `npx vitest run && npm run build && npm run preview`
Expected: tests pass, build succeeds. In the preview build:
- Full scroll narrative works (both directions).
- Mobile emulation (iPhone viewport): scroll works via touch, layout holds, no horizontal overflow.
- Reduced-motion emulation still works in the production build.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: mobile polish, readme, launch checklist"
```

---

## Post-plan checklist (user actions)

- Generate the 3 images with `assets/PROMPTS.md`, drop into `public/scenes/`.
- Send BeatStars store id / profile URL, social links, contact email.
- `npx vercel --prod` when happy.
