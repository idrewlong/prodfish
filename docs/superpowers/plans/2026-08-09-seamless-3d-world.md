# Seamless 3D World Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 2.5D depth-plane scene with one continuous three.js world — camera on a Catmull-Rom path from a foggy field, through the chapel door, down a candle-lit aisle to a neon cross — with crows scattering and candles igniting as scroll beats.

**Architecture:** The site's spine (Lenis scroll, GSAP ScrollTrigger master timeline scrubbing a shared state object, five-act spans, device tiers, reduced-motion/no-WebGL fallbacks, hero + beats DOM) is unchanged. The scene layer is rebuilt: pure modules (`path.js`, `events.js`) hold all scroll math and are unit-tested; `world.js`/`crows.js`/`candles.js` assemble the scene; `sceneManager.js` composes them and reads state every frame. Models are scaled/positioned to fit fixed path landmarks — the world adapts to the path, never the reverse.

**Tech Stack:** three ^0.185.1 (GLTFLoader, DRACOLoader, EffectComposer from `three/addons`), gsap ^3.15 + ScrollTrigger, lenis ^1.3.26, vite ^8, vitest ^4, `@gltf-transform/cli` (new devDependency) for asset compression. Assets: Sketchfab CC-BY (chapel, crow) + Higgsfield-generated GLBs (cross, gravestones, trees).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-09-seamless-3d-world-design.md`.
- Branch: work stays on `feat/southern-gothic-site`.
- Library asset licenses: **CC0 or CC-BY only** (site is commercial — no NC). Record license at download time in `ATTRIBUTIONS.md`.
- Budgets: ≤ 60k triangles total scene; textures ≤ 2048px after pipeline.
- Only new dependency allowed: devDependency `@gltf-transform/cli`.
- Palette/copy: keep existing CSS vars (`--night #050607`, `--blood #c1170f`, `--bone #d8d3c8`); no copy changes to hero/beats sections.
- Every task: run `npm test` before committing; commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Existing acts (`src/choreography.js` `ACTS`) keep their exact spans: arrival [0,0.15], approach [0.15,0.45], threshold [0.45,0.62], chapel [0.62,0.82], beats [0.82,1].

---

### Task 1: Camera path module

**Files:**
- Create: `src/world/path.js`
- Test: `tests/path.test.js`

**Interfaces:**
- Consumes: nothing (pure, three.js math only).
- Produces: `LANDMARKS` (named `THREE.Vector3`s), `positionAt(t): THREE.Vector3` (arc-length parameterized, clamped), `targetAt(t): THREE.Vector3` (look-ahead point), `tNearest(point): number`, constants `T_GATE`, `T_DOOR`, `T_ALTAR`. Later tasks position every model relative to `LANDMARKS`.

- [ ] **Step 1: Write the failing test**

```js
// tests/path.test.js
import { describe, it, expect } from 'vitest';
import { LANDMARKS, positionAt, targetAt, tNearest, T_DOOR, T_GATE, T_ALTAR } from '../src/world/path.js';

describe('path', () => {
  it('starts at START and ends at ALTAR_STOP', () => {
    expect(positionAt(0).distanceTo(LANDMARKS.START)).toBeLessThan(0.01);
    expect(positionAt(1).distanceTo(LANDMARKS.ALTAR_STOP)).toBeLessThan(0.01);
  });
  it('clamps t outside 0..1', () => {
    expect(positionAt(-1).distanceTo(positionAt(0))).toBeLessThan(0.001);
    expect(positionAt(2).distanceTo(positionAt(1))).toBeLessThan(0.001);
  });
  it('z decreases monotonically along the journey (always moving inward)', () => {
    let prev = positionAt(0).z;
    for (let t = 0.05; t <= 1.001; t += 0.05) {
      const z = positionAt(Math.min(t, 1)).z;
      expect(z).toBeLessThanOrEqual(prev + 0.15); // small tolerance for curve wiggle
      prev = z;
    }
  });
  it('T_DOOR passes through the doorway plane', () => {
    const p = positionAt(T_DOOR);
    expect(Math.abs(p.x)).toBeLessThan(0.35);
    expect(Math.abs(p.z)).toBeLessThan(0.35);
  });
  it('landmark ordering: gate before door before altar', () => {
    expect(T_GATE).toBeLessThan(T_DOOR);
    expect(T_DOOR).toBeLessThan(T_ALTAR);
  });
  it('camera always looks forward (target z below position z mid-path)', () => {
    for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      expect(targetAt(t).z).toBeLessThan(positionAt(t).z);
    }
  });
  it('tNearest finds the door', () => {
    expect(Math.abs(tNearest(LANDMARKS.DOOR) - T_DOOR)).toBeLessThan(0.01);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/path.test.js`
Expected: FAIL — cannot resolve `../src/world/path.js`.

- [ ] **Step 3: Write the implementation**

```js
// src/world/path.js
import * as THREE from 'three';

// Named world landmarks (meters, y = eye height-ish). The world is built to
// fit these — models are scaled/positioned to the path, never the reverse.
// Doorway plane is z = 0; interior extends to negative z.
export const LANDMARKS = {
  START:      new THREE.Vector3(0, 2.2, 46),
  FIELD_MID:  new THREE.Vector3(1.8, 1.9, 30),
  BEND:       new THREE.Vector3(-1.6, 1.7, 18),
  GATE:       new THREE.Vector3(0.6, 1.6, 10),
  DOOR_FRONT: new THREE.Vector3(0, 1.55, 3.2),
  DOOR:       new THREE.Vector3(0, 1.5, 0),
  AISLE_IN:   new THREE.Vector3(0, 1.5, -3),
  AISLE_MID:  new THREE.Vector3(0, 1.5, -7),
  ALTAR_STOP: new THREE.Vector3(0, 1.6, -10.5),
};

const curve = new THREE.CatmullRomCurve3(
  [
    LANDMARKS.START, LANDMARKS.FIELD_MID, LANDMARKS.BEND, LANDMARKS.GATE,
    LANDMARKS.DOOR_FRONT, LANDMARKS.DOOR, LANDMARKS.AISLE_IN,
    LANDMARKS.AISLE_MID, LANDMARKS.ALTAR_STOP,
  ],
  false,
  'centripetal',
  0.5,
);

export function positionAt(t) {
  return curve.getPointAt(THREE.MathUtils.clamp(t, 0, 1));
}

// Look slightly ahead along the path; near the end, hold on the altar wall.
export function targetAt(t) {
  const ahead = Math.min(THREE.MathUtils.clamp(t, 0, 1) + 0.04, 1);
  const p = curve.getPointAt(ahead);
  if (ahead === 1) p.z -= 2;
  return p;
}

// Arc-length t whose point is nearest to `point` (sampled search).
export function tNearest(point) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i <= 400; i++) {
    const t = i / 400;
    const d = curve.getPointAt(t).distanceToSquared(point);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

export const T_GATE = tNearest(LANDMARKS.GATE);
export const T_DOOR = tNearest(LANDMARKS.DOOR);
export const T_ALTAR = tNearest(LANDMARKS.ALTAR_STOP);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/path.test.js`
Expected: PASS (7 tests). If the monotonic-z test fails, reduce the x-offsets of `FIELD_MID`/`BEND` — do not loosen the test tolerance.

- [ ] **Step 5: Commit**

```bash
git add src/world/path.js tests/path.test.js
git commit -m "feat: camera path module with landmarks and arc-length lookup"
```

---

### Task 2: Choreography state and device tiers rework

**Files:**
- Modify: `src/choreography.js`
- Modify: `src/device.js:1-4`
- Test: `tests/choreography.test.js`, `tests/device.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `createState()` returning `{ pathT, doorT, crowT, candleT, swayAmp, fog, fireflies, crossGlow }` (all numbers; this exact shape is what the timeline tweens and the scene manager reads). `TIERS.low/high` each `{ particles, dprCap, candleLights, crows }`. `ACTS` unchanged.

- [ ] **Step 1: Update the tests to the new state shape**

Replace the `createState` describe block in `tests/choreography.test.js` (keep the `ACTS` block untouched):

```js
describe('createState', () => {
  it('starts before the scene: path start, everything dark and still', () => {
    const s = createState();
    expect(s.pathT).toBe(0);
    expect(s.doorT).toBe(0);
    expect(s.crowT).toBe(0);
    expect(s.candleT).toBe(0);
    expect(s.crossGlow).toBe(0);
    expect(s.fireflies).toBe(0);
    expect(s.swayAmp).toBe(1);
    expect(s.fog).toBeGreaterThan(0);
  });
  it('returns independent objects', () => {
    const a = createState();
    const b = createState();
    a.pathT = 1;
    expect(b.pathT).toBe(0);
  });
});
```

Replace the `TIERS` describe block in `tests/device.test.js` (keep `deviceTier` tests untouched):

```js
describe('TIERS', () => {
  it('has settings for both tiers', () => {
    for (const t of ['low', 'high']) {
      expect(TIERS[t].particles).toBeGreaterThan(0);
      expect(TIERS[t].dprCap).toBeGreaterThan(0);
      expect(TIERS[t].candleLights).toBeGreaterThan(0);
      expect(TIERS[t].crows).toBeGreaterThan(0);
    }
  });
  it('low tier is lighter than high tier', () => {
    expect(TIERS.low.particles).toBeLessThan(TIERS.high.particles);
    expect(TIERS.low.candleLights).toBeLessThan(TIERS.high.candleLights);
    expect(TIERS.low.crows).toBeLessThanOrEqual(TIERS.high.crows);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/choreography.test.js tests/device.test.js`
Expected: FAIL — `pathT` undefined, `candleLights` undefined.

- [ ] **Step 3: Update the implementations**

In `src/choreography.js`, keep `ACTS` exactly as-is and replace `createState`:

```js
// Shared animation state. The timeline tweens this; the scene manager
// reads it every frame. DOM overlays are tweened directly by GSAP.
export function createState() {
  return {
    pathT: 0,        // 0..1 position along the camera path (arc length)
    doorT: 0,        // 0..1 chapel door swing
    crowT: 0,        // 0..1 crow-scatter progress
    candleT: 0,      // 0..1 candle ignition progress down the aisle
    swayAmp: 1,      // ambient camera sway multiplier
    fog: 0.075,      // FogExp2 density
    fireflies: 0,    // firefly particle opacity
    crossGlow: 0,    // neon cross + altar light intensity
  };
}
```

In `src/device.js`, replace `TIERS` (rest of file unchanged):

```js
export const TIERS = {
  low:  { particles: 60,  dprCap: 1.5, candleLights: 2, crows: 3 },
  high: { particles: 140, dprCap: 2,   candleLights: 6, crows: 5 },
};
```

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS (path, choreography, device).

- [ ] **Step 5: Commit**

```bash
git add src/choreography.js src/device.js tests/choreography.test.js tests/device.test.js
git commit -m "feat: path-based choreography state and 3D-world tier settings"
```

---

### Task 3: Scroll-event logic module

**Files:**
- Create: `src/world/events.js`
- Test: `tests/events.test.js`

**Interfaces:**
- Consumes: nothing (pure math, no three.js).
- Produces: `clamp01(v)`, `candleIntensity(candleT, i, total): 0..1`, `litCount(candleT, total): int`, `crowPhase(crowT, i): 0..1`, `doorAngle(doorT): radians`. Crows/candles/scene manager consume these; they are the single source of truth for stagger timing.

- [ ] **Step 1: Write the failing test**

```js
// tests/events.test.js
import { describe, it, expect } from 'vitest';
import { clamp01, candleIntensity, litCount, crowPhase, doorAngle } from '../src/world/events.js';

describe('candleIntensity', () => {
  it('all candles dark at 0, all fully lit at 1', () => {
    for (let i = 0; i < 12; i++) {
      expect(candleIntensity(0, i, 12)).toBe(0);
      expect(candleIntensity(1, i, 12)).toBe(1);
    }
  });
  it('candles ignite in aisle order', () => {
    const t = 0.4;
    for (let i = 1; i < 12; i++) {
      expect(candleIntensity(t, i, 12)).toBeLessThanOrEqual(candleIntensity(t, i - 1, 12));
    }
  });
  it('ignition is gradual (some candle mid-fade at t=0.5)', () => {
    const vals = Array.from({ length: 12 }, (_, i) => candleIntensity(0.5, i, 12));
    expect(vals.some((v) => v > 0 && v < 1)).toBe(true);
  });
});

describe('litCount', () => {
  it('counts partially and fully lit candles', () => {
    expect(litCount(0, 12)).toBe(0);
    expect(litCount(1, 12)).toBe(12);
    const mid = litCount(0.5, 12);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(12);
  });
});

describe('crowPhase', () => {
  it('all perched at 0, all gone at 1', () => {
    for (let i = 0; i < 5; i++) {
      expect(crowPhase(0, i)).toBe(0);
      expect(crowPhase(1, i)).toBe(1);
    }
  });
  it('takeoff is staggered: earlier crows lead', () => {
    expect(crowPhase(0.2, 0)).toBeGreaterThan(crowPhase(0.2, 3));
  });
});

describe('doorAngle', () => {
  it('closed at 0, opens inward past 100 degrees at 1, clamped', () => {
    expect(doorAngle(0)).toBe(0);
    expect(doorAngle(1)).toBeLessThan(-1.7);
    expect(doorAngle(2)).toBe(doorAngle(1));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/events.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```js
// src/world/events.js
// Pure scroll-event math. Single source of truth for stagger timing so the
// visuals stay scrub-safe: every value derives from timeline-tweened state.

export function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

// Candle i of `total` ignites in aisle order; each fade-in overlaps the next.
export function candleIntensity(candleT, i, total) {
  const start = (i / total) * 0.85; // last candle still finishes before t=1
  const width = 1.5 / total;
  return clamp01((clamp01(candleT) - start) / width);
}

export function litCount(candleT, total) {
  let n = 0;
  for (let i = 0; i < total; i++) if (candleIntensity(candleT, i, total) > 0) n++;
  return n;
}

// Crow i's flight phase: staggered takeoff, ~0.6 of crowT to clear out.
export function crowPhase(crowT, i) {
  const start = Math.min(i * 0.08, 0.4);
  return clamp01((clamp01(crowT) - start) / 0.6);
}

// Door swings inward (negative y-rotation) up to ~110 degrees.
export function doorAngle(doorT) {
  return -clamp01(doorT) * 1.92;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/events.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/world/events.js tests/events.test.js
git commit -m "feat: pure scroll-event math for candles, crows, door"
```

---

### Task 4: Library assets and compression pipeline

**Files:**
- Create: `assets/source/` model folders, `scripts/build-assets.mjs`, `ATTRIBUTIONS.md`, `public/models/` (generated)
- Modify: `package.json` (devDependency + script)

**Interfaces:**
- Consumes: nothing.
- Produces: `public/models/church.glb`, `public/models/crow.glb` (Draco-compressed, textures ≤ 2048px); npm script `assets:build` that rebuilds `public/models/` from `assets/source/`; `ATTRIBUTIONS.md`. Later tasks load models from `/models/<name>.glb`.

**⚠️ USER ACTION REQUIRED (Sketchfab requires a logged-in account to download):**

- [ ] **Step 1: Ask the user to download the two library models**

Post this request and wait:

> Please download these two free models from Sketchfab (log in, click **Download 3D model**, choose **glTF**):
> 1. Church (CC-BY, interior + exterior) — https://sketchfab.com/3d-models/church-867a847b67364484bf44912e1af190af → unzip into `assets/source/church/`
> 2. Animated crow (CC-BY) — https://sketchfab.com/3d-models/crow-d5a9b0df4da3493688b63ce42c8a83e2 → unzip into `assets/source/crow/`
>
> Each folder should end up containing a `scene.gltf` (plus `.bin` and `textures/`).
>
> If either model is unavailable, any CC0/CC-BY substitutes work: a small church/chapel **with interior** and a crow/raven **with a flight animation**. Note the author + license of whatever you download.

If the church cannot be sourced with a usable interior at all, stop and surface the spec's fallback (Approach C — separate dressed interior) to the user before continuing.

- [ ] **Step 2: Verify the downloads**

Run: `ls assets/source/church assets/source/crow`
Expected: `scene.gltf` present in each. Then:

Run: `npm i -D @gltf-transform/cli && npx gltf-transform inspect assets/source/church/scene.gltf`
Expected: install succeeds; inspect prints mesh/texture tables. Confirm church total triangles ≤ 30k (budget headroom); note the count.

- [ ] **Step 3: Write the pipeline script**

```js
// scripts/build-assets.mjs
// Compresses every model in assets/source/<name>/scene.gltf (or .glb)
// into public/models/<name>.glb: Draco geometry, WebP textures <= 2048px.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'assets/source';
const OUT = 'public/models';
mkdirSync(OUT, { recursive: true });

for (const name of readdirSync(SRC, { withFileTypes: true })) {
  if (!name.isDirectory()) continue;
  const dir = join(SRC, name.name);
  const input = ['scene.gltf', 'scene.glb', `${name.name}.glb`, `${name.name}.gltf`]
    .map((f) => join(dir, f))
    .find(existsSync);
  if (!input) {
    console.warn(`skip ${name.name}: no scene.gltf/.glb found`);
    continue;
  }
  const out = join(OUT, `${name.name}.glb`);
  console.log(`${input} -> ${out}`);
  execSync(
    `npx gltf-transform optimize "${input}" "${out}" --compress draco --texture-compress webp --texture-size 2048`,
    { stdio: 'inherit' },
  );
}
```

Add to `package.json` scripts: `"assets:build": "node scripts/build-assets.mjs"`.

- [ ] **Step 4: Run the pipeline and verify output**

Run: `npm run assets:build && ls -la public/models && npx gltf-transform inspect public/models/church.glb`
Expected: `church.glb` and `crow.glb` exist; church.glb noticeably smaller than source; inspect shows Draco compression and textures ≤ 2048. Verify the crow kept its animation: `npx gltf-transform inspect public/models/crow.glb` lists ≥ 1 animation.

- [ ] **Step 5: Write ATTRIBUTIONS.md**

```markdown
# Asset Attributions

This site uses the following third-party 3D assets:

- **Church** by Tiago Lopes — https://sketchfab.com/3d-models/church-867a847b67364484bf44912e1af190af — CC Attribution 4.0 (https://creativecommons.org/licenses/by/4.0/)
- **Crow (animated)** by Alexei Ostapenko — https://sketchfab.com/3d-models/crow-d5a9b0df4da3493688b63ce42c8a83e2 — CC Attribution 4.0 (https://creativecommons.org/licenses/by/4.0/)

AI-generated assets (Higgsfield, generated for this project, no attribution
required): listed here for provenance once generated.

Models were converted to compressed GLB (Draco/WebP) for delivery; no other
modifications.
```

Adjust names/URLs/licenses to what was actually downloaded in Step 1.

- [ ] **Step 6: Commit**

```bash
git add assets/source scripts/build-assets.mjs ATTRIBUTIONS.md public/models package.json package-lock.json
git commit -m "assets: church + crow (CC-BY) with gltf-transform pipeline"
```

---

### Task 5: Higgsfield-generated set dressing

**Files:**
- Create: `assets/source/cross/`, `assets/source/gravestone-a/`, `assets/source/gravestone-b/`, `assets/source/tree-a/`, `assets/source/tree-b/` (each containing a generated `.glb`)
- Modify: `ATTRIBUTIONS.md`

**Interfaces:**
- Consumes: `assets:build` script from Task 4.
- Produces: `public/models/cross.glb`, `gravestone-a.glb`, `gravestone-b.glb`, `tree-a.glb`, `tree-b.glb`. World assembly (Task 7) and candles module (Task 9) load these but must tolerate their absence (fallback primitives), so this task failing partway never blocks the build.

- [ ] **Step 1: Generate the five assets via the higgsfield-generate skill**

Invoke the `higgsfield-generate` skill once per asset (it owns model choice and CLI syntax — describe the asset and that output must be a **3D model / GLB**). Prompts (derived from `assets/PROMPTS.md` art direction — southern gothic, weathered, night):

1. `cross` — "3D model, GLB: a simple neon cross sign, two straight glowing red tubes on a thin dark metal mounting frame, like a roadside church neon sign. Clean geometry, low-poly, game-ready."
2. `gravestone-a` — "3D model, GLB: weathered rounded-top stone gravestone, cracked and moss-stained, sunken slightly crooked. Southern gothic. Low-poly game asset."
3. `gravestone-b` — "3D model, GLB: weathered stone cross grave marker, eroded edges, lichen stains. Southern gothic. Low-poly game asset."
4. `tree-a` — "3D model, GLB: dead leafless tree, gnarled twisting bare branches, dark bark. Southern gothic swamp tree. Low-poly game asset."
5. `tree-b` — "3D model, GLB: dead leafless tree, taller and thinner, few crooked branches, dark bark. Low-poly game asset."

Save each result as `assets/source/<name>/<name>.glb`.

- [ ] **Step 2: Inspect each generated model**

Run for each: `npx gltf-transform inspect assets/source/<name>/<name>.glb`
Acceptance per asset: loads without error, ≤ 8k triangles (trees ≤ 10k), has normals. If one fails or looks degenerate: retry generation once with the same prompt; if it fails again, **skip it** — record the skip in the task summary. Fallbacks already planned: primitive-built cross (Task 9), box/cone silhouettes for graves/trees (Task 7), or the CC0 Kenney Graveyard Kit (https://kenney.nl/assets/graveyard-kit, direct download, no login) if all generation fails.

- [ ] **Step 3: Rebuild the model bundle**

Run: `npm run assets:build && ls public/models`
Expected: the new `.glb`s appear alongside `church.glb` and `crow.glb`.

- [ ] **Step 4: Record provenance**

Append to `ATTRIBUTIONS.md` under the AI-generated section, one line per asset actually generated:

```markdown
- **Neon cross / gravestones / dead trees** — generated with Higgsfield AI for this project, 2026-08.
```

- [ ] **Step 5: Commit**

```bash
git add assets/source public/models ATTRIBUTIONS.md
git commit -m "assets: Higgsfield-generated cross, gravestones, dead trees"
```

---

### Task 6: Asset loader and loading overlay

**Files:**
- Create: `src/world/assets.js`, `public/draco/` (decoder files)
- Modify: `index.html` (loading overlay div), `src/style.css` (overlay styles)
- Delete: `src/scenes/loader.js` usage comes later (Task 11); do not touch it here.

**Interfaces:**
- Consumes: `public/models/*.glb` from Tasks 4–5.
- Produces: `createAssetLoader()` returning `{ optional(url): Promise<GLTF|null>, required(url, retries=2): Promise<GLTF> }`; DOM: `#loading` overlay hidden by adding class `ready` to `<body>`. Task 11's boot sequence consumes both.

- [ ] **Step 1: Copy the Draco decoder locally (no CDN dependency)**

Run: `mkdir -p public/draco && cp node_modules/three/examples/jsm/libs/draco/gltf/* public/draco/ && ls public/draco`
Expected: `draco_decoder.wasm`, `draco_wasm_wrapper.js` (and `.js` fallback) present.

- [ ] **Step 2: Write the loader module**

```js
// src/world/assets.js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export function createAssetLoader() {
  const draco = new DRACOLoader();
  draco.setDecoderPath('/draco/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  return {
    // Optional prop: a missing/broken file logs and returns null — the
    // world renders without it rather than blocking.
    async optional(url) {
      try {
        return await loader.loadAsync(url);
      } catch (e) {
        console.warn(`asset skipped: ${url}`, e);
        return null;
      }
    },
    // Required (the chapel): retry, then throw — caller keeps the loading
    // screen up and offers retry.
    async required(url, retries = 2) {
      let lastErr;
      for (let i = 0; i <= retries; i++) {
        try {
          return await loader.loadAsync(url);
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr;
    },
  };
}
```

- [ ] **Step 3: Add the loading overlay**

In `index.html`, after `<div id="blackout" ...></div>` add:

```html
<div id="loading" aria-hidden="true"><span>entering&hellip;</span></div>
```

In `src/style.css`, after the `#blackout` rule add:

```css
#loading {
  position: fixed;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  font-size: 0.7rem;
  letter-spacing: 0.5em;
  text-transform: uppercase;
  color: rgba(216, 211, 200, 0.4);
  transition: opacity 0.9s ease;
}
body.ready #loading { opacity: 0; pointer-events: none; }
.reduced #loading, .no-webgl #loading { display: none; }
```

- [ ] **Step 4: Verify nothing broke**

Run: `npm test && npm run build`
Expected: tests pass; vite build succeeds (loader module compiles, unused for now).

- [ ] **Step 5: Commit**

```bash
git add src/world/assets.js public/draco index.html src/style.css
git commit -m "feat: tolerant GLB asset loader with local draco and loading overlay"
```

---

### Task 7: World assembly — ground, fog, chapel, props

**Files:**
- Create: `src/world/world.js`
- Test: `tests/world.test.js`

**Interfaces:**
- Consumes: `LANDMARKS`, `positionAt` from `src/world/path.js`.
- Produces: `PROP_SPOTS` (`{ graves: [[x, z, rotY, scale]...], trees: [...] }`), `minPathClearance(spots): number` (pure, tested), and `buildWorld({ scene, models })` → `{ chapelRoot, door, altarAnchor, roofline }` where `models` is `{ church, cross, gravestoneA, gravestoneB, treeA, treeB }` (GLTF or null each). `door` is always a valid hinged `THREE.Group` (built, not from the model). `altarAnchor` is a `THREE.Object3D` at the altar wall; `roofline` is `{ y: number, z: number }` for crow perches.

- [ ] **Step 1: Write the failing test (pure parts only)**

```js
// tests/world.test.js
import { describe, it, expect } from 'vitest';
import { PROP_SPOTS, minPathClearance } from '../src/world/world.js';

describe('PROP_SPOTS', () => {
  it('keeps every prop clear of the camera corridor', () => {
    expect(minPathClearance(PROP_SPOTS.graves)).toBeGreaterThan(1.4);
    expect(minPathClearance(PROP_SPOTS.trees)).toBeGreaterThan(2.0);
  });
  it('props are outdoors (positive z, before the door plane)', () => {
    for (const [, z] of [...PROP_SPOTS.graves, ...PROP_SPOTS.trees]) {
      expect(z).toBeGreaterThan(1);
    }
  });
  it('has enough set dressing to read as a graveyard', () => {
    expect(PROP_SPOTS.graves.length).toBeGreaterThanOrEqual(8);
    expect(PROP_SPOTS.trees.length).toBeGreaterThanOrEqual(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/world.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```js
// src/world/world.js
import * as THREE from 'three';
import { positionAt } from './path.js';

// Hand-placed prop spots [x, z, rotY, scale] flanking the path's S-curve.
// Deterministic (no Math.random) so the corridor-clearance test is real.
export const PROP_SPOTS = {
  graves: [
    [-3.2, 34, 0.3, 1], [3.6, 31, -0.2, 0.9], [-2.8, 27, 0.8, 1.1],
    [4.2, 24, -0.5, 1], [-4.5, 21, 0.1, 0.85], [3.4, 17, 0.6, 1],
    [-3.0, 14, -0.4, 0.95], [3.8, 12, 0.2, 1.05], [-3.6, 8.5, -0.7, 1],
    [3.1, 6.5, 0.4, 0.9],
  ],
  trees: [
    [-6.5, 38, 0, 1.1], [7, 33, 1.2, 1], [-7.5, 26, 2.1, 0.9],
    [6.8, 20, 0.4, 1.2], [-6.2, 13, 2.8, 1], [7.2, 8, 1.7, 0.95],
  ],
};

// Minimum horizontal distance from any spot to the sampled camera path.
export function minPathClearance(spots) {
  let min = Infinity;
  for (const [x, z] of spots) {
    for (let i = 0; i <= 200; i++) {
      const p = positionAt(i / 200);
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < min) min = d;
    }
  }
  return min;
}

function silhouette(kind) {
  // Fallback primitive when a GLB is missing: a dark shape in the fog.
  const mat = new THREE.MeshStandardMaterial({ color: '#0c0f0d', roughness: 1 });
  if (kind === 'tree') {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.28, 4.5, 6), mat);
    trunk.position.y = 2.25;
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 2.4, 5), mat);
    limb.position.set(0.5, 3.6, 0);
    limb.rotation.z = -0.9;
    g.add(trunk, limb);
    return g;
  }
  const stone = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.16), mat);
  stone.position.y = 0.45;
  stone.rotation.x = (Math.abs(kind.length % 3) - 1) * 0.04;
  const g = new THREE.Group();
  g.add(stone);
  return g;
}

function place(scene, template, spots) {
  for (const [x, z, rotY, s] of spots) {
    const obj = template.clone(true);
    obj.position.set(x, 0, z);
    obj.rotation.y = rotY;
    obj.scale.multiplyScalar(s);
    scene.add(obj);
  }
}

// Normalize a GLTF scene: uniform scale to targetHeight, feet on y=0,
// centered on x/z origin. Returns the wrapped group.
function normalize(gltfScene, targetHeight) {
  const root = new THREE.Group();
  root.add(gltfScene);
  const box = new THREE.Box3().setFromObject(gltfScene);
  const size = box.getSize(new THREE.Vector3());
  const scale = targetHeight / size.y;
  gltfScene.scale.setScalar(scale);
  box.setFromObject(gltfScene);
  const center = box.getCenter(new THREE.Vector3());
  gltfScene.position.x -= center.x;
  gltfScene.position.z -= center.z;
  gltfScene.position.y -= box.min.y;
  return root;
}

export function buildWorld({ scene, models }) {
  // Ground: a big dark disc; fog swallows the edge.
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(90, 48),
    new THREE.MeshStandardMaterial({ color: '#070a08', roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Moonlight from behind the chapel + a whisper of ambient.
  const moon = new THREE.DirectionalLight('#b9c4d6', 0.5);
  moon.position.set(-6, 18, -30);
  scene.add(moon, new THREE.AmbientLight('#1a2028', 0.6));

  // Chapel: scaled to ~9m tall, doorway on the z=0 plane facing +z.
  // If the model is somehow null (dev only), a box shell keeps the world testable.
  let chapelRoot;
  if (models.church) {
    chapelRoot = normalize(models.church.scene, 9);
    // Push back so the front facade sits just behind the doorway plane.
    const box = new THREE.Box3().setFromObject(chapelRoot);
    chapelRoot.position.z = -(box.max.z - 0.4);
    // Hide any authored door mesh — we hinge our own for scroll control.
    chapelRoot.traverse((o) => {
      if (o.isMesh && /door/i.test(o.name)) o.visible = false;
    });
  } else {
    chapelRoot = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(8, 9, 14),
      new THREE.MeshStandardMaterial({ color: '#0d0f11', roughness: 1, side: THREE.BackSide }),
    );
    shell.position.set(0, 4.5, -7);
    chapelRoot.add(shell);
  }
  scene.add(chapelRoot);

  // Our own hinged door in the doorway plane (hinge on the left jamb).
  const door = new THREE.Group();
  door.position.set(-0.75, 0, 0);
  const leaf = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 2.6, 0.09),
    new THREE.MeshStandardMaterial({ color: '#171310', roughness: 0.9 }),
  );
  leaf.position.set(0.75, 1.3, 0);
  door.add(leaf);
  scene.add(door);

  // Red light bleeding through the doorway from inside.
  const doorGlow = new THREE.PointLight('#c1170f', 8, 9, 2);
  doorGlow.position.set(0, 1.6, -1.2);
  scene.add(doorGlow);

  // Set dressing, real GLB or silhouette.
  const grave = models.gravestoneA?.scene ?? silhouette('grave');
  const graveB = models.gravestoneB?.scene ?? silhouette('graveb');
  const tree = models.treeA?.scene ?? silhouette('tree');
  const treeB = models.treeB?.scene ?? silhouette('tree');
  const half = Math.ceil(PROP_SPOTS.graves.length / 2);
  place(scene, normalizeProp(grave, 1.1), PROP_SPOTS.graves.slice(0, half));
  place(scene, normalizeProp(graveB, 1.3), PROP_SPOTS.graves.slice(half));
  place(scene, normalizeProp(tree, 6), PROP_SPOTS.trees.filter((_, i) => i % 2 === 0));
  place(scene, normalizeProp(treeB, 7), PROP_SPOTS.trees.filter((_, i) => i % 2 === 1));

  // Altar anchor: where the cross + altar light mount (interior back wall).
  const altarAnchor = new THREE.Object3D();
  altarAnchor.position.set(0, 2.4, -12.3);
  scene.add(altarAnchor);

  const chapelBox = new THREE.Box3().setFromObject(chapelRoot);
  return {
    chapelRoot,
    door,
    altarAnchor,
    roofline: { y: chapelBox.max.y - 0.2, z: chapelBox.min.z * 0.25 },
  };
}

function normalizeProp(objScene, targetHeight) {
  return normalize(objScene, targetHeight);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS, including the new corridor-clearance tests. If clearance fails, move the offending spot outward — do not lower the threshold.

- [ ] **Step 5: Commit**

```bash
git add src/world/world.js tests/world.test.js
git commit -m "feat: world assembly with chapel normalization, props, hinged door"
```

---

### Task 8: Crows

**Files:**
- Create: `src/world/crows.js`

**Interfaces:**
- Consumes: `crowPhase` from `src/world/events.js`; crow GLTF (with flight animation) or null; `roofline` from `buildWorld`.
- Produces: `createCrows({ scene, gltf, roofline, count })` → `{ update(crowT, elapsed) }`. Scene manager calls `update` every frame with `state.crowT` and clock time.

- [ ] **Step 1: Write the implementation** (render-only module; logic already tested via events.js)

```js
// src/world/crows.js
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { crowPhase } from './events.js';

// Crows perch on the roofline and scatter along per-crow escape curves as
// crowT sweeps 0->1. All motion derives from crowT, so scrubbing back
// re-perches them.
export function createCrows({ scene, gltf, roofline, count }) {
  const crows = [];
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const perch = new THREE.Vector3(
      side * (0.6 + (i % 3) * 0.9),
      roofline.y,
      roofline.z + (i - count / 2) * 0.7,
    );
    const escape = new THREE.CatmullRomCurve3([
      perch,
      perch.clone().add(new THREE.Vector3(side * 2.5, 2.2, 2.5)),
      perch.clone().add(new THREE.Vector3(side * 7, 7, 6)),
      perch.clone().add(new THREE.Vector3(side * 14, 12, 10)),
    ]);

    let obj;
    let mixer = null;
    let clipDuration = 0;
    if (gltf) {
      obj = skeletonClone(gltf.scene); // safe clone for skinned meshes
      if (gltf.animations.length) {
        mixer = new THREE.AnimationMixer(obj);
        const clip = gltf.animations[0];
        clipDuration = clip.duration;
        mixer.clipAction(clip).play();
      }
      // Normalize to ~0.45m wingspan-ish scale.
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      obj.scale.setScalar(0.45 / Math.max(size.x, size.y, size.z));
    } else {
      // Fallback: a small dark cone reads as a bird silhouette in fog.
      obj = new THREE.Mesh(
        new THREE.ConeGeometry(0.09, 0.3, 5),
        new THREE.MeshStandardMaterial({ color: '#05060a', roughness: 1 }),
      );
      obj.rotation.x = Math.PI / 2;
    }
    obj.position.copy(perch);
    scene.add(obj);
    crows.push({ obj, mixer, clipDuration, perch, escape });
  }

  const tmp = new THREE.Vector3();
  return {
    update(crowT, elapsed) {
      crows.forEach((c, i) => {
        const phase = crowPhase(crowT, i);
        if (phase <= 0) {
          c.obj.position.copy(c.perch);
          c.obj.visible = true;
          if (c.mixer) c.mixer.setTime(0);
          return;
        }
        c.obj.visible = phase < 0.98;
        c.escape.getPointAt(Math.min(phase, 1), tmp);
        c.obj.position.copy(tmp);
        // Face flight direction.
        const ahead = c.escape.getPointAt(Math.min(phase + 0.02, 1));
        c.obj.lookAt(ahead);
        // Scrub the flap cycle off phase + a wing-beat off elapsed time.
        if (c.mixer) {
          const flap = (phase * 6 + elapsed * 0.6 + i * 0.3) % 1;
          c.mixer.setTime(flap * c.clipDuration);
        }
      });
    },
  };
}
```

- [ ] **Step 2: Verify it compiles and existing tests pass**

Run: `npm test && npm run build`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add src/world/crows.js
git commit -m "feat: scrub-safe crow scatter with skeleton-cloned flight animation"
```

---

### Task 9: Candles and the neon cross

**Files:**
- Create: `src/world/candles.js`

**Interfaces:**
- Consumes: `candleIntensity` from `src/world/events.js`; `altarAnchor` from `buildWorld`; cross GLTF or null; `tier.candleLights`.
- Produces: `createCandles({ scene, altarAnchor, crossGltf, maxLights })` → `{ update(candleT, crossGlow, elapsed), TOTAL }`. Scene manager calls `update` every frame.

- [ ] **Step 1: Write the implementation**

```js
// src/world/candles.js
import * as THREE from 'three';
import { candleIntensity } from './events.js';

const TOTAL = 14;

// Candle rows flank the aisle (x = ±0.9) from just inside the door to the
// altar. Flames are additive-blended planes; a small pool of real point
// lights follows the most recently lit candles so low tiers stay cheap.
export function createCandles({ scene, altarAnchor, crossGltf, maxLights }) {
  const candles = [];
  const flameMat = new THREE.MeshBasicMaterial({
    color: '#ff9a3d',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  for (let i = 0; i < TOTAL; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = -2.6 - (i / TOTAL) * 7.4;
    const g = new THREE.Group();
    const wax = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.045, 0.28, 8),
      new THREE.MeshStandardMaterial({ color: '#8f887a', roughness: 0.8 }),
    );
    wax.position.y = 0.14;
    const flame = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.16), flameMat.clone());
    flame.position.y = 0.36;
    g.add(wax, flame);
    g.position.set(side * 0.9, 0.55, z); // on low pew-end stands
    scene.add(g);
    candles.push({ flame });
  }

  // Shared light pool.
  const lights = Array.from({ length: maxLights }, () => {
    const l = new THREE.PointLight('#ff7a26', 0, 3.2, 2);
    scene.add(l);
    return l;
  });

  // Neon cross: generated GLB if present, else two emissive bars.
  let cross;
  if (crossGltf) {
    cross = crossGltf.scene;
    const box = new THREE.Box3().setFromObject(cross);
    cross.scale.setScalar(2.2 / box.getSize(new THREE.Vector3()).y);
    cross.traverse((o) => {
      if (o.isMesh) o.material = new THREE.MeshBasicMaterial({ color: '#ff2318' });
    });
  } else {
    cross = new THREE.Group();
    const barMat = new THREE.MeshBasicMaterial({ color: '#ff2318' });
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 0.12), barMat);
    const h = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.16, 0.12), barMat);
    h.position.y = 0.45;
    cross.add(v, h);
  }
  altarAnchor.add(cross);

  const crossLight = new THREE.PointLight('#c1170f', 0, 22, 1.6);
  altarAnchor.add(crossLight);

  return {
    TOTAL,
    update(candleT, crossGlow, elapsed) {
      const litIdx = [];
      candles.forEach((c, i) => {
        const k = candleIntensity(candleT, i, TOTAL);
        c.flame.material.opacity = k;
        c.flame.scale.y = 0.8 + 0.2 * Math.sin(elapsed * 11 + i * 2.1);
        if (k > 0.15) litIdx.push(i);
      });
      // Real lights track the last-lit candles (highest indices).
      lights.forEach((l, j) => {
        const idx = litIdx[litIdx.length - 1 - j];
        if (idx === undefined) { l.intensity = 0; return; }
        const side = idx % 2 === 0 ? -1 : 1;
        l.position.set(side * 0.9, 0.95, -2.6 - (idx / TOTAL) * 7.4);
        l.intensity = 1.6 * (0.85 + 0.15 * Math.sin(elapsed * 13 + idx));
      });
      // Neon cross hum + altar wash.
      const flicker = 0.92 + 0.08 * Math.sin(elapsed * 30) * Math.sin(elapsed * 7.3);
      cross.visible = crossGlow > 0.01;
      crossLight.intensity = crossGlow * 14 * flicker;
    },
  };
}
```

- [ ] **Step 2: Verify compile + tests**

Run: `npm test && npm run build`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add src/world/candles.js
git commit -m "feat: aisle candles with light pool and neon cross"
```

---

### Task 10: Scene manager rewrite

**Files:**
- Rewrite: `src/scenes/sceneManager.js`
- Modify: `src/scenes/particles.js:34-37` (firefly spawn band)

**Interfaces:**
- Consumes: `positionAt`, `targetAt` (path.js); `buildWorld` (world.js); `createCrows`, `createCandles`; `doorAngle` (events.js); `createFireflies`, `createPost` (existing); `TIERS` (device.js); state shape from Task 2.
- Produces: `initScene({ canvas, state, tier, models })` → `{ renderer, scene, camera, render }`. `models` is the object of loaded GLTFs (each possibly null) built in Task 11. `render()` reads `state` each frame — no other public API.

- [ ] **Step 1: Rewrite `src/scenes/sceneManager.js`**

```js
import * as THREE from 'three';
import { TIERS } from '../device.js';
import { positionAt, targetAt } from '../world/path.js';
import { buildWorld } from '../world/world.js';
import { createCrows } from '../world/crows.js';
import { createCandles } from '../world/candles.js';
import { doorAngle } from '../world/events.js';
import { createFireflies } from './particles.js';
import { createPost } from './post.js';

export function initScene({ canvas, state, tier, models }) {
  const settings = TIERS[tier];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  renderer.setClearColor('#050607', 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.dprCap));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#050607');
  scene.fog = new THREE.FogExp2('#050607', state.fog);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 130);

  const world = buildWorld({ scene, models });
  const crows = createCrows({
    scene, gltf: models.crow, roofline: world.roofline, count: settings.crows,
  });
  const candles = createCandles({
    scene,
    altarAnchor: world.altarAnchor,
    crossGltf: models.cross,
    maxLights: settings.candleLights,
  });

  const fireflies = createFireflies(settings.particles);
  scene.add(fireflies);

  const post = createPost(renderer, scene, camera);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    post.composer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();
  const look = new THREE.Vector3();
  function render() {
    const t = clock.getElapsedTime();

    // Camera rides the path; ambient sway layered on top so the scene
    // breathes even when scroll is idle.
    const pos = positionAt(state.pathT);
    camera.position.set(
      pos.x + Math.sin(t * 0.28) * 0.14 * state.swayAmp,
      pos.y + Math.sin(t * 0.19) * 0.08 * state.swayAmp,
      pos.z,
    );
    look.copy(targetAt(state.pathT));
    camera.lookAt(look);

    world.door.rotation.y = doorAngle(state.doorT);
    scene.fog.density = state.fog;

    crows.update(state.crowT, t);
    candles.update(state.candleT, state.crossGlow, t);

    fireflies.material.uniforms.uTime.value = t;
    fireflies.material.uniforms.uOpacity.value = state.fireflies;
    post.setTime(t);
    post.composer.render();
  }

  return { renderer, scene, camera, render };
}
```

- [ ] **Step 2: Retune the firefly spawn band to world coordinates**

In `src/scenes/particles.js` replace the three position lines inside the loop:

```js
    pos[i * 3] = (Math.random() - 0.5) * 22;      // x across the field
    pos[i * 3 + 1] = 0.3 + Math.random() * 1.6;   // y: grass height band
    pos[i * 3 + 2] = 6 + Math.random() * 38;      // z: along the approach
```

- [ ] **Step 3: Verify compile + tests**

Run: `npm test && npm run build`
Expected: all green (main.js still calls the old signature — build may warn but must compile; if the build fails on the old `initScene` call signature mismatch it will be fixed in Task 11, in that case run `npx vitest run` only and note it).

- [ ] **Step 4: Commit**

```bash
git add src/scenes/sceneManager.js src/scenes/particles.js
git commit -m "feat: scene manager rides the camera path through the 3D world"
```

---

### Task 11: Timeline and boot rewrite

**Files:**
- Rewrite: `src/timeline.js`
- Rewrite: `src/main.js`

**Interfaces:**
- Consumes: `ACTS`, `createState`; `initScene({ canvas, state, tier, models })` from Task 10; `createAssetLoader` from Task 6; `initScroll` (unchanged).
- Produces: `buildTimeline(state)` (same export name as before); boot flow that loads models, hides `#loading` via `document.body.classList.add('ready')`, and starts the render loop. `?debug` mode: a range slider driving `state.pathT` (and proportional `doorT`/`crowT`/`candleT`/`crossGlow`) without scrolling, for calibration.

- [ ] **Step 1: Rewrite `src/timeline.js`**

```js
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ACTS } from './choreography.js';
import { T_DOOR } from './world/path.js';

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

  // Path keyframes derive from the door's real arc-length position so the
  // camera reaches the doorway exactly at the threshold act, whatever the
  // curve's proportions are.
  const DOOR_FRONT_T = T_DOOR - 0.07; // a few meters shy of the door
  const DOOR_IN_T = Math.min(T_DOOR + 0.05, 0.9); // just inside the nave

  // ACT 1 — ARRIVAL: world emerges out of black; barely any motion yet.
  tl.to(state, { pathT: 0.08, duration: arrivalEnd }, 0)
    .to(state, { fireflies: 1, duration: arrivalEnd * 0.8 }, 0.01)
    .to('#blackout', { opacity: 0, duration: arrivalEnd * 0.8 }, 0.01)
    .to('#hero', { opacity: 0, y: -70, duration: 0.08 }, arrivalEnd - 0.03);

  // ACT 2 — APPROACH: the long walk; fog thickens; crows scatter mid-way.
  tl.to(state, { pathT: DOOR_FRONT_T, duration: approachEnd - approachStart, ease: 'power1.inOut' }, approachStart)
    .to(state, { fog: 0.1, duration: approachEnd - approachStart }, approachStart)
    .to(state, { swayAmp: 0.5, duration: approachEnd - approachStart }, approachStart)
    .to(state, { crowT: 1, duration: 0.14 }, 0.28);

  // ACT 3 — THRESHOLD: door swings open, red glow spills, we step through.
  tl.to(state, { doorT: 1, duration: 0.1, ease: 'power2.inOut' }, thresholdStart)
    .to('#glow', { opacity: 0.85, duration: 0.08 }, thresholdStart + 0.02)
    .to('#glow', { opacity: 0, duration: 0.06 }, thresholdEnd - 0.06)
    .to(state, { pathT: DOOR_IN_T, duration: thresholdEnd - thresholdStart, ease: 'power1.in' }, thresholdStart)
    .to(state, { fireflies: 0, duration: 0.08 }, thresholdStart + 0.04)
    .to(state, { fog: 0.05, duration: 0.08 }, thresholdEnd - 0.08);

  // ACT 4 — CHAPEL: down the aisle; candles ignite; the cross hums on.
  tl.to(state, { pathT: 0.97, duration: chapelEnd - chapelStart, ease: 'power1.out' }, chapelStart)
    .to(state, { candleT: 1, duration: (chapelEnd - chapelStart) * 0.9 }, chapelStart + 0.02)
    .to(state, { crossGlow: 1, duration: 0.1 }, chapelStart)
    .to(state, { swayAmp: 0.3, duration: 0.1 }, chapelStart);

  // ACT 5 — BEATS: settle before the altar; residual drift only.
  tl.to(state, { pathT: 1, duration: 1 - chapelEnd }, chapelEnd);

  return tl;
}
```

- [ ] **Step 2: Rewrite `src/main.js`**

```js
import { gsap } from 'gsap';
import { createState } from './choreography.js';
import { detectTier } from './device.js';
import { initScene } from './scenes/sceneManager.js';
import { createAssetLoader } from './world/assets.js';
import { T_DOOR, T_GATE } from './world/path.js';
import { initScroll } from './scroll.js';
import { buildTimeline } from './timeline.js';

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

async function loadModels() {
  const load = createAssetLoader();
  const [church, crow, cross, gravestoneA, gravestoneB, treeA, treeB] = await Promise.all([
    load.required('/models/church.glb').catch((e) => {
      console.error('chapel failed to load', e);
      return null; // world.js builds a shell; loading screen still clears
    }),
    load.optional('/models/crow.glb'),
    load.optional('/models/cross.glb'),
    load.optional('/models/gravestone-a.glb'),
    load.optional('/models/gravestone-b.glb'),
    load.optional('/models/tree-a.glb'),
    load.optional('/models/tree-b.glb'),
  ]);
  return { church, crow, cross, gravestoneA, gravestoneB, treeA, treeB };
}

async function boot() {
  const state = createState();
  const tier = detectTier();
  const models = await loadModels();
  const app = initScene({ canvas: document.getElementById('scene'), state, tier, models });
  document.body.classList.add('ready');

  initScroll();
  buildTimeline(state);
  gsap.ticker.add(() => app.render());
}

// Reduced motion: one static framed view of the approach, no scroll scrub.
async function bootStatic() {
  const state = createState();
  state.pathT = 0.32;
  state.swayAmp = 0;
  state.fireflies = 0.6;
  const models = await loadModels();
  const app = initScene({ canvas: document.getElementById('scene'), state, tier: 'low', models });
  document.body.classList.add('ready');
  let frames = 0;
  const tick = () => {
    app.render();
    if (++frames > 5) gsap.ticker.remove(tick);
  };
  gsap.ticker.add(tick);
}

// ?debug: slider drives the journey without scrolling — for calibration.
async function bootDebug() {
  const state = createState();
  const models = await loadModels();
  const app = initScene({ canvas: document.getElementById('scene'), state, tier: 'high', models });
  document.body.classList.add('ready');
  document.getElementById('blackout').style.opacity = '0';
  document.getElementById('hero').style.display = 'none';

  const slider = document.createElement('input');
  Object.assign(slider, { type: 'range', min: 0, max: 1000, value: 0 });
  slider.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);width:60%;z-index:10';
  document.body.appendChild(slider);
  slider.addEventListener('input', () => {
    const p = slider.value / 1000;
    state.pathT = p;
    state.doorT = gsap.utils.clamp(0, 1, (p - (T_DOOR - 0.1)) * 10);
    state.crowT = gsap.utils.clamp(0, 1, (p - T_GATE + 0.05) * 5);
    state.candleT = gsap.utils.clamp(0, 1, (p - T_DOOR) * 5);
    state.crossGlow = gsap.utils.clamp(0, 1, (p - T_DOOR + 0.05) * 6);
  });
  gsap.ticker.add(() => app.render());
}

if (prefersReduced) document.body.classList.add('reduced');

if (!webglAvailable()) {
  document.body.classList.add('no-webgl');
} else if (new URLSearchParams(location.search).has('debug')) {
  bootDebug();
} else if (prefersReduced) {
  bootStatic();
} else {
  boot();
}
```

- [ ] **Step 3: Verify tests and build**

Run: `npm test && npm run build`
Expected: all green, no unresolved imports.

- [ ] **Step 4: Smoke-test in the browser**

Run: `npm run dev` (background), open `http://localhost:5173/?debug`.
Expected: loading fades, world visible, slider walks the full journey: field → gate → door opens → aisle → candles → cross. Note (don't yet fix) any placement issues.

- [ ] **Step 5: Commit**

```bash
git add src/timeline.js src/main.js
git commit -m "feat: timeline drives the seamless path; boot loads models with debug slider"
```

---

### Task 12: Cleanup, credits, fallbacks, final verification

**Files:**
- Delete: `src/scenes/depthPlane.js`, `src/scenes/placeholders.js`, `src/scenes/loader.js`, `public/scenes/` (old imagery), `assets/source/*.jpg` if any old source images remain (keep model folders and `assets/PROMPTS.md`)
- Modify: `index.html` (footer credits line)

**Interfaces:**
- Consumes: everything prior.
- Produces: a repo with no dead scene code, on-site CC-BY attribution, verified fallbacks, green tests and build.

- [ ] **Step 1: Delete the dead 2.5D modules and confirm nothing imports them**

```bash
git rm src/scenes/depthPlane.js src/scenes/placeholders.js src/scenes/loader.js
git rm -r public/scenes
grep -rn "depthPlane\|placeholders\|loadSceneTextures" src/ tests/ || echo CLEAN
```

Expected: `CLEAN`. If `main.js` or `sceneManager.js` still reference them, remove those imports (they should already be gone from Tasks 10–11).

- [ ] **Step 2: Add on-site attribution (CC-BY requirement)**

In `index.html`, replace the footer line:

```html
<footer class="chapel-footer">
  © prodfish. recorded after dark.<br />
  3d: church — tiago lopes (cc-by) · crow — alexei ostapenko (cc-by)
</footer>
```

Adjust names to match the actual `ATTRIBUTIONS.md` entries from Task 4.

- [ ] **Step 3: Full verification**

```bash
npm test
npm run build
```

Expected: every test passes; build succeeds. Then `npm run dev` and check, in a real browser:

1. **Normal scroll:** black → title → world fades in → long approach (trees/graves sliding past in fog) → crows scatter around 30% → door swings open with red spill → pass through the doorway with no cut → candles ignite in order down the aisle → neon cross glowing → beats section scrolls up. Scroll **backward**: everything reverses (door closes, crows re-perch, candles die).
2. **Reduced motion** (emulate via devtools rendering settings): static framed exterior, page scrolls as plain document, beats section reachable.
3. **No WebGL** (devtools → disable WebGL, or set `webglAvailable` to return false temporarily): CSS-gradient fallback page renders, no console errors.
4. **Console:** no errors; missing optional models produce warnings at most.

- [ ] **Step 4: Fix-forward calibration**

If the smoke test shows placement/scale issues (chapel too small, facade facing the wrong way, door misaligned with `z=0`, candles inside pews), fix the constants (`normalize` target height and `chapelRoot.position.z` in `world.js` — add `chapelRoot.rotation.y = Math.PI` if the facade faces away from the camera — candle `z` range in `candles.js`) using the `?debug` slider, re-run `npm test`, and include fixes in this task's commit. Landmark positions in `path.js` are the reference frame — do not move them to fit a model.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: seamless 3D world — cleanup, credits, verified fallbacks"
```
