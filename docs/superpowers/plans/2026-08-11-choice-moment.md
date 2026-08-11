# The Choice Moment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carve the signpost's words into the wood, make the sign itself clickable, and stop the journey at the fork until the visitor chooses a road.

**Architecture:** Text becomes a white-on-transparent canvas texture on thin planes fixed to each sign arm; the plane's *material colour* supplies the ink, so hover can light the letters without redrawing anything. Clicking is a raycast against the arm meshes. Parking is achieved by shortening the document rather than intercepting scroll — with the master ScrollTrigger pinned to a **fixed pixel distance** representing the whole journey, a short document simply cannot advance the timeline past the fork.

**Tech Stack:** three ^0.185.1 (CanvasTexture, Raycaster), gsap ^3.15 + ScrollTrigger, lenis, vite ^8, vitest ^4.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-11-choice-moment-design.md`.
- Branch: `main`, working directly. No pushing to the remote.
- 62 tests currently pass. Never weaken or delete an existing assertion.
- `T_FORK_SCROLL` (0.30, from `src/world/path.js`) is the fraction of the full journey at which the fork sits, on **both** routes. All parking maths derives from it.
- The existing route-switch logic in `src/main.js` scrolls to the fork **before** rebuilding the timeline. That ordering is load-bearing (it prevents a visible camera rewind) — preserve it.
- Out of scope, and must not be touched: engraved gravestone text, the extended swamp route, the dirt path on the work road, the work-route pacing bug, the rider's building. Stages 2 and 3 own those.
- Every task: run `npm test` before committing; commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Visual checks use the existing driver: `cd /private/tmp/claude-501/-Users-idrew-Desktop-git-repo-prodfish/9d973f9c-4036-413b-9dbb-075332062cfc/scratchpad && node drive.mjs`, then Read the PNGs in `shots/`.

## File Structure

| File | Responsibility |
|---|---|
| `src/world/engraving.js` (new) | canvas → `THREE.CanvasTexture` of letterforms, plus the pure text-fitting maths |
| `src/picking.js` (new) | pointer → NDC, and raycasting NDC against a set of meshes |
| `src/journey.js` (new) | pure parking maths: journey height per route, track height, scroll distance |
| `src/world/monuments.js` (modify) | arms carry engraved text planes and route tags |
| `src/timeline.js` (modify) | ScrollTrigger pinned to a fixed distance instead of `bottom bottom` |
| `src/main.js` (modify) | picking + hover wiring, accessible controls, idle prompt, remove DOM sign buttons |
| `index.html`, `src/style.css` (modify) | hidden controls, idle prompt, drop `.sign-arm` styles |

---

### Task 1: Engraved text on the sign arms

**Files:**
- Create: `src/world/engraving.js`
- Modify: `src/world/monuments.js`
- Test: `tests/engraving.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `fitFontPx(text, maxWidthPx, basePx)` — pure; the pixel font size that fits `text` within `maxWidthPx`, never exceeding `basePx`.
  - `makeEngravedTexture(text, { widthPx, heightPx, basePx })` → `THREE.CanvasTexture`. Letters are drawn **solid white on transparent**: the texture carries only letterform alpha, and the material's colour supplies the ink. That is what lets hover light the words without redrawing the canvas.
  - `ENGRAVED_INK` (`0x0d0a08`) and `ENGRAVED_LIT` (`0xe8c98a`) — the resting and hover colours.
  - From `monuments.js`: `buildMonuments` return value gains `signArms` — an array of two `THREE.Mesh` arm objects, each with `userData.route` set to `'direct'` or `'work'` and `userData.textMesh` pointing at its text plane. Tasks 2 and 4 consume these.

- [ ] **Step 1: Write the failing test**

```js
// tests/engraving.test.js
import { describe, it, expect } from 'vitest';
import { fitFontPx, ENGRAVED_INK, ENGRAVED_LIT } from '../src/world/engraving.js';

describe('fitFontPx', () => {
  it('never exceeds the base size for short text', () => {
    expect(fitFontPx('the work', 400, 64)).toBe(64);
  });
  it('shrinks long text to fit the board', () => {
    const long = fitFontPx('the work and everything after it', 400, 64);
    expect(long).toBeLessThan(64);
    expect(long).toBeGreaterThan(0);
  });
  it('is monotonic — longer text never gets a bigger size', () => {
    const a = fitFontPx('the work', 400, 64);
    const b = fitFontPx('the work of a lifetime', 400, 64);
    expect(b).toBeLessThanOrEqual(a);
  });
  it('never returns a size so small it would be unreadable', () => {
    expect(fitFontPx('x'.repeat(500), 400, 64)).toBeGreaterThanOrEqual(8);
  });
});

describe('engraving colours', () => {
  it('rests dark and lights warm, so hover reads as a change', () => {
    expect(ENGRAVED_INK).toBeLessThan(ENGRAVED_LIT);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engraving.test.js`
Expected: FAIL — cannot resolve `../src/world/engraving.js`.

- [ ] **Step 3: Write the implementation**

```js
// src/world/engraving.js
import * as THREE from 'three';

// Words carved into wood, not printed on it. The canvas carries ONLY the
// letterform alpha (solid white on transparent); the mesh material supplies
// the colour. That split is what lets a hover light the letters by changing
// one material colour, with no canvas redraw and no second texture.
export const ENGRAVED_INK = 0x0d0a08; // cut into the shadowed grain
export const ENGRAVED_LIT = 0xe8c98a; // catching a little lantern light

// Average glyph width for this face is close enough to 0.5em for fitting a
// short sign legend; measuring per-glyph would need a canvas, and this runs
// in tests where there isn't one.
const AVG_GLYPH_EM = 0.5;
const MIN_FONT_PX = 8;

export function fitFontPx(text, maxWidthPx, basePx) {
  const chars = Math.max(text.length, 1);
  const fitted = maxWidthPx / (chars * AVG_GLYPH_EM);
  return Math.max(MIN_FONT_PX, Math.min(basePx, Math.floor(fitted)));
}

export function makeEngravedTexture(text, { widthPx = 512, heightPx = 128, basePx = 76 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');

  const fontPx = fitFontPx(text, widthPx * 0.88, basePx);
  ctx.font = `${fontPx}px Georgia, "Times New Roman", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // A carved letter is a groove: a dark cut with a bright lip along its top
  // edge where the light catches. Drawing the lip slightly offset and then
  // the cut over it gives that read at a glance, without a normal map.
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText(text, widthPx / 2, heightPx / 2 - fontPx * 0.045);
  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.fillText(text, widthPx / 2, heightPx / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}
```

- [ ] **Step 4: Carve the words into the arms**

In `src/world/monuments.js`, add to the imports:

```js
import { makeEngravedTexture, ENGRAVED_INK } from './engraving.js';
```

Inside `buildSignpost`, replace the two plain arm meshes with arms that carry
text planes. Keep the existing positions, rotations and `wood` material —
only the text planes and the `userData` tagging are new:

```js
  const armGeo = new THREE.BoxGeometry(1.5, 0.26, 0.06);

  // A thin plane sitting a hair proud of the board's front face. Separating
  // the letters from the board means the wording can change without
  // touching geometry, and hover can tint the words alone.
  function carve(arm, text, route) {
    const tex = makeEngravedTexture(text);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.38, 0.22),
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        color: ENGRAVED_INK,
        depthWrite: false,
      }),
    );
    plane.position.z = 0.032; // just clear of the board's +z face
    arm.add(plane);
    arm.userData.route = route;
    arm.userData.textMesh = plane;
    return arm;
  }

  const beatsArm = carve(new THREE.Mesh(armGeo, wood), 'the beats', 'direct');
  beatsArm.position.set(-0.62, 2.25, 0);
  beatsArm.rotation.z = 0.04;
  const workArm = carve(new THREE.Mesh(armGeo, wood), 'the work', 'work');
  workArm.position.set(0.62, 1.85, 0);
  workArm.rotation.z = -0.05;
  group.add(beatsArm, workArm);
```

Change `buildSignpost`'s return to `return { group, anchor, arms: [beatsArm, workArm] };`
and in `buildMonuments`, surface it: the returned object becomes

```js
  return { anchors: { sign: sign.anchor, credits, crypt: crypt.anchor }, signArms: sign.arms };
```

- [ ] **Step 5: Verify**

Run: `npm test && npm run build`
Expected: 67 tests pass (62 + 5 new), build clean.

- [ ] **Step 6: Commit**

```bash
git add src/world/engraving.js tests/engraving.test.js src/world/monuments.js
git commit -m "feat: carve the signpost's words into the boards"
```

---

### Task 2: Pointer picking

**Files:**
- Create: `src/picking.js`
- Test: `tests/picking.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `pointerToNdc(clientX, clientY, rect)` → `{ x, y }` in normalised device coordinates.
  - `createPicker({ camera })` → `{ setTargets(meshes), pick(ndc) }` where `pick` returns the first hit mesh carrying a `userData.route`, or `null`. Task 4 wires this to pointer events.

- [ ] **Step 1: Write the failing test**

```js
// tests/picking.test.js
import { describe, it, expect } from 'vitest';
import { pointerToNdc } from '../src/picking.js';

const rect = { left: 100, top: 50, width: 800, height: 400 };

describe('pointerToNdc', () => {
  it('maps the centre of the canvas to the origin', () => {
    expect(pointerToNdc(500, 250, rect)).toEqual({ x: 0, y: 0 });
  });
  it('maps the top-left corner to (-1, 1)', () => {
    expect(pointerToNdc(100, 50, rect)).toEqual({ x: -1, y: 1 });
  });
  it('maps the bottom-right corner to (1, -1)', () => {
    expect(pointerToNdc(900, 450, rect)).toEqual({ x: 1, y: -1 });
  });
  it('accounts for the canvas offset rather than assuming the viewport', () => {
    // Same client point, canvas moved: the NDC must differ.
    const moved = { left: 0, top: 0, width: 800, height: 400 };
    expect(pointerToNdc(500, 250, moved)).not.toEqual(pointerToNdc(500, 250, rect));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/picking.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```js
// src/picking.js
import * as THREE from 'three';

// Normalised device coordinates measured against the CANVAS, not the window
// — the canvas is full-bleed today, but assuming that would break silently
// the moment anything is laid out around it.
export function pointerToNdc(clientX, clientY, rect) {
  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: -((clientY - rect.top) / rect.height) * 2 + 1,
  };
}

export function createPicker({ camera }) {
  const raycaster = new THREE.Raycaster();
  const point = new THREE.Vector2();
  let targets = [];

  return {
    setTargets(meshes) {
      targets = meshes ?? [];
    },
    // Returns the nearest hit that actually represents a choice, so stray
    // decorative geometry can never be "clicked".
    pick(ndc) {
      if (!targets.length) return null;
      point.set(ndc.x, ndc.y);
      raycaster.setFromCamera(point, camera);
      for (const hit of raycaster.intersectObjects(targets, true)) {
        let node = hit.object;
        while (node) {
          if (node.userData?.route) return node;
          node = node.parent;
        }
      }
      return null;
    },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: 71 pass (67 + 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/picking.js tests/picking.test.js
git commit -m "feat: pointer picking for in-world choices"
```

---

### Task 3: Park the journey at the fork

**Files:**
- Create: `src/journey.js`
- Modify: `src/timeline.js`, `src/main.js`
- Test: `tests/journey.test.js`

**Interfaces:**
- Consumes: `T_FORK_SCROLL` from `src/world/path.js`.
- Produces:
  - `JOURNEY_VH` — `{ direct: 1000, work: 1600 }`.
  - `trackHeightVh(route, chosen)` — the `#scroll-track` height in `vh`.
  - `journeyDistancePx(route, innerHeight)` — the scroll distance the timeline spans.
  Task 4 and `main.js` consume all three.

- [ ] **Step 1: Write the failing test**

```js
// tests/journey.test.js
import { describe, it, expect } from 'vitest';
import { JOURNEY_VH, trackHeightVh, journeyDistancePx } from '../src/journey.js';
import { T_FORK_SCROLL } from '../src/world/path.js';

describe('journey sizing', () => {
  it('gives the scenic route more scroll than the direct one', () => {
    expect(JOURNEY_VH.work).toBeGreaterThan(JOURNEY_VH.direct);
  });

  it('once chosen, the track is the full height of that route', () => {
    expect(trackHeightVh('direct', true)).toBe(JOURNEY_VH.direct);
    expect(trackHeightVh('work', true)).toBe(JOURNEY_VH.work);
  });

  it('before choosing, the document ends exactly at the fork', () => {
    // Scrollable distance is height minus one viewport. The unchosen track
    // must expose exactly T_FORK_SCROLL of the direct route's scrollable
    // distance, so the timeline can advance to the fork and no further.
    const h = trackHeightVh(null, false);
    const scrollable = h - 100;
    const fullScrollable = JOURNEY_VH.direct - 100;
    expect(scrollable / fullScrollable).toBeCloseTo(T_FORK_SCROLL, 5);
  });

  it('the unchosen track is shorter than either full route', () => {
    expect(trackHeightVh(null, false)).toBeLessThan(JOURNEY_VH.direct);
  });

  it('journey distance is the scrollable pixels of the full route', () => {
    expect(journeyDistancePx('direct', 800)).toBe((1000 / 100 - 1) * 800);
    expect(journeyDistancePx('work', 800)).toBe((1600 / 100 - 1) * 800);
  });

  it('journey distance ignores how tall the document currently is', () => {
    // This is the whole point: progress is measured against the full
    // journey, so a short document caps progress instead of compressing
    // the entire timeline into it.
    expect(journeyDistancePx('direct', 800)).toBe(journeyDistancePx('direct', 800));
    expect(journeyDistancePx('direct', 1000)).toBeGreaterThan(journeyDistancePx('direct', 800));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/journey.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```js
// src/journey.js
import { T_FORK_SCROLL } from './world/path.js';

// How much scroll each road is worth. The scenic route covers more ground,
// so it needs more scroll to hold the same unhurried pace.
export const JOURNEY_VH = { direct: 1000, work: 1600 };

const VIEWPORT_VH = 100;

// Before a road is chosen the document simply ends at the signpost: there is
// nothing left to scroll, so the journey parks itself without intercepting
// or fighting a single scroll event.
export function trackHeightVh(route, chosen) {
  if (chosen && JOURNEY_VH[route]) return JOURNEY_VH[route];
  const fullScrollable = JOURNEY_VH.direct - VIEWPORT_VH;
  return T_FORK_SCROLL * fullScrollable + VIEWPORT_VH;
}

// The scroll distance the master timeline spans. Deliberately derived from
// the FULL route rather than the current document height: pinning the
// timeline to a fixed distance is what makes a short document cap progress
// at the fork instead of cramming the whole journey into a few screens.
export function journeyDistancePx(route, innerHeight) {
  const vh = JOURNEY_VH[route] ?? JOURNEY_VH.direct;
  return (vh / VIEWPORT_VH - 1) * innerHeight;
}
```

- [ ] **Step 4: Pin the timeline to a fixed distance**

In `src/timeline.js`, add to the imports:

```js
import { journeyDistancePx } from './journey.js';
```

Replace the `scrollTrigger` block's `end` line so the whole block reads:

```js
    scrollTrigger: {
      trigger: '#scroll-track',
      start: 'top top',
      // Pinned to the full journey's distance, NOT to the element's height.
      // The document is deliberately short before a road is chosen, and
      // `bottom bottom` would squeeze the entire timeline -- church, altar
      // and embed -- into those few screens. A fixed distance instead means
      // a short document simply runs out partway, parking the camera at the
      // fork. Function form so it re-measures on refresh/resize.
      end: () => `+=${journeyDistancePx(route, window.innerHeight)}`,
      // fix-round: 1.2 -> 2 -- extra scrub lag smooths out residual scroll
      // jitter now that the approach pathT tween below is a single gentle
      // ease instead of two tweens with an accelerating tail.
      scrub: 2,
    },
```

- [ ] **Step 5: Drive the track height from the journey module**

In `src/main.js`, add to the imports:

```js
import { trackHeightVh } from './journey.js';
```

Inside `boot()`, immediately before `let timeline = buildTimeline(state, state.route);`, add:

```js
  // Park the journey: until a road is chosen the document ends at the
  // signpost. See src/journey.js for why this is a height change rather
  // than a scroll interception.
  const track = document.getElementById('scroll-track');
  track.style.height = `${trackHeightVh(null, false)}vh`;
```

Then, in the `createRouteState` callback, replace the hard-coded height line

```js
    document.getElementById('scroll-track').style.height = next === 'work' ? '1600vh' : '1000vh';
```

with

```js
    track.style.height = `${trackHeightVh(next, true)}vh`;
```

Leave the rest of that callback — the scroll-to-fork before `buildTimeline`, and the `ScrollTrigger.refresh()` — exactly as it is. That ordering prevents a visible camera rewind.

- [ ] **Step 6: Verify**

Run: `npm test && npm run build`
Expected: 77 pass (71 + 6 new), build clean.

- [ ] **Step 7: Commit**

```bash
git add src/journey.js tests/journey.test.js src/timeline.js src/main.js
git commit -m "feat: park the journey at the fork until a road is chosen"
```

---

### Task 4: Put the sign where the parked camera can read it

**Files:**
- Modify: `src/world/monuments.js`
- Test: `tests/monuments.test.js` (append; leave existing assertions alone)

**Interfaces:**
- Consumes: `positionAt`, `targetAt`, `tNearest`, `FORK` from `src/world/path.js`.
- Produces: an updated `SIGNPOST_SPOT`, a new `SIGNPOST_ROT_Y`, and `signViewAngleDeg()` — the angle between the parked camera's forward direction and the direction to the sign. Task 5 relies on the sign actually being on screen.

**Why this task exists:** the sign currently stands at `(-2.70, 25.13)`, but the camera parks at the fork at `z ≈ 24.03` travelling toward *lower* z. The sign is therefore **behind the camera** at the exact moment the visitor is asked to read it — which matches the "signpost fades from frame by 28–30% scroll" observation logged when the fork was wired. Parking cannot simply stop earlier: the fork fraction is where both routes coincide, and that is what makes switching roads seamless. So the sign moves instead.

- [ ] **Step 1: Write the failing test**

Append to `tests/monuments.test.js`:

```js
import { SIGNPOST_ROT_Y, signViewAngleDeg } from '../src/world/monuments.js';

describe('signpost framing', () => {
  it('sits in front of the camera when the journey parks at the fork', () => {
    // Guards the bug this task fixes: a sign behind the camera at the moment
    // of the choice. Anything past ~25 degrees drifts to the frame edge.
    expect(signViewAngleDeg()).toBeLessThan(25);
  });
  it('still clears both roads', () => {
    const [x, z] = SIGNPOST_SPOT;
    expect(minDistanceToRouteFor(x, z, 'work')).toBeGreaterThan(1.4);
    expect(minDistanceToRouteFor(x, z, 'direct')).toBeGreaterThan(1.4);
  });
  it('is turned to face the parked camera rather than down the road', () => {
    expect(SIGNPOST_ROT_Y).toBeGreaterThan(0.4);
    expect(SIGNPOST_ROT_Y).toBeLessThan(0.9);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/monuments.test.js`
Expected: FAIL — `SIGNPOST_ROT_Y` and `signViewAngleDeg` are not exported, and the current spot would fail the angle check anyway.

- [ ] **Step 3: Write the implementation**

In `src/world/monuments.js`, add `targetAt` and `tNearest` to the existing import from `./path.js`, then replace the `SIGNPOST_SPOT` declaration with:

```js
// Measured against the parked camera, not eyeballed. The journey stops at
// the fork (camera ~(0.09, 1.80, 24.03), travelling toward lower z), so a
// sign standing level with or behind that point is out of frame exactly
// when it needs to be read. This spot sits ~6m ahead and to the left:
// 16.4 degrees off the camera's centre line, with 2.12m clearance from the
// direct road and 5.91m from the scenic one.
export const SIGNPOST_SPOT = [-3.64, 19.19];

// Turned to face the parked camera, so the boards present their faces
// rather than their edges at the moment of the choice.
export const SIGNPOST_ROT_Y = 0.66;

// Angle between the parked camera's forward direction and the direction to
// the sign. The test above uses this to guarantee the sign is on screen.
export function signViewAngleDeg() {
  const tFork = tNearest(FORK, 'direct');
  const cam = positionAt(tFork, 'direct');
  const look = targetAt(tFork, 'direct');
  const fx = look.x - cam.x;
  const fz = look.z - cam.z;
  const fLen = Math.hypot(fx, fz);
  const [sx, sz] = SIGNPOST_SPOT;
  const vx = sx - cam.x;
  const vz = sz - cam.z;
  const vLen = Math.hypot(vx, vz);
  const cos = (fx * vx + fz * vz) / (fLen * vLen);
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
}
```

Then in `buildSignpost`, replace the hard-coded rotation line

```js
  group.rotation.y = 0.38;
```

with

```js
  group.rotation.y = SIGNPOST_ROT_Y;
```

- [ ] **Step 4: Verify**

Run: `npm test && npm run build`
Expected: 80 pass (77 + 3 new), build clean. If the angle assertion fails, move the spot further along the camera's forward direction rather than widening the tolerance — the tolerance is the requirement.

- [ ] **Step 5: Commit**

```bash
git add src/world/monuments.js tests/monuments.test.js
git commit -m "fix: stand the signpost where the parked camera can read it"
```

---

### Task 5: Click, hover, keyboard, and the idle prompt

**Files:**
- Modify: `src/main.js`, `index.html`, `src/style.css`

**Interfaces:**
- Consumes: `createPicker`, `pointerToNdc` (Task 2); `signArms` from `buildMonuments` (Task 1); `ENGRAVED_INK`, `ENGRAVED_LIT` (Task 1); `createRouteState` (existing).
- Produces: the finished interaction. No new exports.

- [ ] **Step 1: Expose the arms from the scene manager**

In `src/scenes/sceneManager.js`, the `buildMonuments(...)` result is already stored as `monuments`. Extend the returned object so `main.js` can reach the arms — change the return to:

```js
  return { renderer, scene, camera, render, labels, anchors: monuments.anchors, signArms: monuments.signArms };
```

- [ ] **Step 2: Add the accessible controls and the idle prompt**

In `index.html`, immediately after the `<div id="labels" …></div>` line, add:

```html
  <div id="sign-controls">
    <button type="button" data-route="direct">the beats — continue to the church</button>
    <button type="button" data-route="work">the work — take the graveyard road</button>
  </div>
  <p id="choose-hint" aria-hidden="true">choose your road</p>
```

In `src/style.css`, append:

```css
/* The words are carved into the sign in the 3D scene, which assistive
   technology cannot see. These are the same two choices as real, focusable
   controls: clipped out of sight rather than display:none, so they stay in
   the tab order and are announced normally. */
#sign-controls button {
  position: fixed;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
#sign-controls button:focus-visible {
  width: auto;
  height: auto;
  margin: 0;
  padding: 0.6rem 1rem;
  clip-path: none;
  left: 50%;
  bottom: 12vh;
  transform: translateX(-50%);
  z-index: 7;
  background: rgba(8, 7, 6, 0.9);
  border: 1px solid var(--blood);
  color: var(--bone);
  font-family: var(--mono);
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

#choose-hint {
  position: fixed;
  left: 50%;
  bottom: 14vh;
  transform: translateX(-50%);
  z-index: 6;
  margin: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 1.2s ease;
  font-family: var(--mono);
  font-size: 0.66rem;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: rgba(216, 211, 200, 0.55);
  text-shadow: 0 0 18px rgba(0, 0, 0, 0.9);
}
#choose-hint.show { opacity: 1; }
.reduced #choose-hint, .no-webgl #choose-hint { display: none; }
```

Delete the now-unused `.label-sign`, `.sign-arm` and `.sign-arm-work` rules from `src/style.css` — the DOM signpost they styled is removed in Step 3.

- [ ] **Step 3: Replace the DOM signpost with in-world interaction**

In `src/main.js`, add to the imports:

```js
import { createPicker, pointerToNdc } from './picking.js';
import { ENGRAVED_INK, ENGRAVED_LIT } from './world/engraving.js';
```

Delete the whole `attachSignpost` function and its call. Replace it with:

```js
// The sign itself is the control: clicking the carved board picks that road.
// Hover lights the letters by changing one material colour -- the canvas
// texture carries only the letterform alpha, so nothing is redrawn.
function attachSignInteraction(app, routeState, canvas) {
  const picker = createPicker({ camera: app.camera });
  picker.setTargets(app.signArms);

  let hovered = null;
  const setHover = (arm) => {
    if (hovered === arm) return;
    if (hovered) hovered.userData.textMesh.material.color.setHex(ENGRAVED_INK);
    hovered = arm;
    if (hovered) hovered.userData.textMesh.material.color.setHex(ENGRAVED_LIT);
    canvas.style.cursor = hovered ? 'pointer' : '';
  };

  const ndcFor = (e) => pointerToNdc(e.clientX, e.clientY, canvas.getBoundingClientRect());

  // Hover is resolved at most once per frame: pointermove fires far faster
  // than the scene renders, and a raycast per event is wasted work.
  let queued = null;
  canvas.addEventListener('pointermove', (e) => {
    if (routeState.isLocked()) { setHover(null); return; }
    queued = ndcFor(e);
  });
  gsap.ticker.add(() => {
    if (!queued) return;
    setHover(picker.pick(queued));
    queued = null;
  });

  canvas.addEventListener('click', (e) => {
    if (routeState.isLocked()) return;
    const arm = picker.pick(ndcFor(e));
    if (arm) routeState.choose(arm.userData.route);
  });

  // Keyboard and screen-reader path: the same two choices as real controls.
  for (const btn of document.querySelectorAll('#sign-controls button')) {
    const arm = app.signArms.find((a) => a.userData.route === btn.dataset.route);
    btn.addEventListener('focus', () => setHover(arm ?? null));
    btn.addEventListener('blur', () => setHover(null));
    btn.addEventListener('click', () => routeState.choose(btn.dataset.route));
  }
}

// A parked page can read as a broken one. If the visitor reaches the sign and
// sits there without choosing, say so quietly.
function attachChooseHint(routeState) {
  const hint = document.getElementById('choose-hint');
  if (!hint) return;
  let idleSince = null;
  gsap.ticker.add(() => {
    const atFork = !routeState.isLocked()
      && window.scrollY >= (document.documentElement.scrollHeight - window.innerHeight) - 4;
    if (!atFork) { idleSince = null; hint.classList.remove('show'); return; }
    if (idleSince === null) idleSince = performance.now();
    if (performance.now() - idleSince > 2500) hint.classList.add('show');
  });
}
```

Then in `boot()`, replace the `attachSignpost(app, routeState);` call with:

```js
  attachSignInteraction(app, routeState, document.getElementById('scene'));
  attachChooseHint(routeState);
```

and, inside the `createRouteState` callback, hide the hint once a road is taken by adding as its first line:

```js
    document.getElementById('choose-hint')?.classList.remove('show');
```

- [ ] **Step 4: Verify tests and build**

Run: `npm test && npm run build`
Expected: 80 pass, build clean.

- [ ] **Step 5: Verify visually — this is the point of the task**

Start the dev server if needed (`curl -sf http://localhost:5173 || (npm run dev >/dev/null 2>&1 &)`, then poll). Edit `drive.mjs` to capture, and Read every screenshot:

1. Scroll to the very bottom of the document and screenshot: the camera must be parked at the signpost with **both arms legible**, and the words must read as carved into the boards rather than floating.
2. Confirm the document cannot go further: record `window.scrollY` at the bottom and confirm the timeline's `pathT` is at the fork, not deep in the church.
3. Wait ~3s at the bottom and screenshot: the "choose your road" hint is visible.
4. Dispatch a `pointermove` over the work arm, then screenshot: its letters are lit and the others are not.
5. Click the work arm; screenshot immediately: the camera must **not** jump, and the document must now be taller.
6. Reload, then tab until a `#sign-controls` button is focused; screenshot: the focused control is visible on screen and its arm is lit. Press Enter and confirm the route changes.
7. Reload and take the direct road; confirm it still reaches the church and the beats embed.

Report exactly what each screenshot showed, including anything that looks wrong even though the tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/main.js src/scenes/sceneManager.js index.html src/style.css
git commit -m "feat: click the carved sign to choose a road, with keyboard parity"
```
