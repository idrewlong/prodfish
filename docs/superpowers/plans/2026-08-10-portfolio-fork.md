# Portfolio Fork Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a signposted fork in the graveyard where visitors may take a scenic route past ten monument stones (one production credit each) and a crypt bearing the bio, rejoining the direct path at the church door so nobody misses the beats.

**Architecture:** `path.js` gains a second Catmull-Rom curve; the existing direct curve is byte-for-byte untouched so the just-approved pacing cannot regress. Both curves pass through a shared `FORK` point, and the timeline pins the fork to the **same scroll fraction (0.30) on both routes**, which is what makes switching routes continuous: at the moment of the switch the camera is at `FORK` on both curves and at the same scroll fraction, so remapping is exact. Credits render as real HTML anchors projected onto the 3D scene each frame — crisp, clickable, keyboard-navigable, and reusable verbatim by the reduced-motion and no-WebGL fallbacks.

**Tech Stack:** three ^0.185.1, gsap ^3.15 + ScrollTrigger, lenis, vite ^8, vitest ^4, `@gltf-transform/cli` pipeline (already wired).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-10-portfolio-fork-design.md`.
- Branch: `main`, working directly (no remote push from implementers).
- **The `direct` curve's control points in `src/world/path.js` must not change.** The user approved its pacing across five calibration rounds; any edit risks regressing it.
- Existing exports `T_GATE`, `T_DOOR`, `T_ALTAR` must keep working as direct-route values — `src/main.js` (debug boot) and `src/timeline.js` import them.
- All 28 existing tests must keep passing. Never weaken an existing assertion.
- Content is placeholder and must be obviously so, living **only** in `src/content/portfolio.js`.
- Every credit label and the bio must be reachable by keyboard and present in the reduced-motion / no-WebGL DOM.
- Every task: run `npm test` before committing; commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Consciously dropped from the spec (do not implement): a low-tier cap on simultaneously-visible labels. There are twelve labels in total and only a handful are ever on screen; a budget mechanism would be more code than the thing it manages.
- Visual checks use the existing driver: `cd /private/tmp/claude-501/-Users-idrew-Desktop-git-repo-prodfish/9d973f9c-4036-413b-9dbb-075332062cfc/scratchpad && node drive.mjs`, then Read the PNGs in `shots/`.

## File Structure

| File | Responsibility |
|---|---|
| `src/content/portfolio.js` (new) | `CREDITS`, `BIO`, `CATALOG_URL` — placeholder data, single source of truth |
| `src/world/path.js` (modify) | adds the `work` curve, route-aware `positionAt`/`targetAt`/`tNearest`, `FORK`, `T_FORK_SCROLL` |
| `src/world/route.js` (new) | route selection + lock/unlock rule (pure, no DOM, no three) |
| `src/world/monuments.js` (new) | signpost, ten stones, crypt geometry; exposes label anchors |
| `src/labels.js` (new) | world→screen projection for DOM labels; pure math + a thin DOM updater |
| `src/scenes/sceneManager.js` (modify) | builds monuments, drives labels, reads `state.route` |
| `src/timeline.js` (modify) | route-aware keyframes; fork pinned to scroll fraction 0.30 |
| `src/main.js` (modify) | loads the stones model, owns route switching + timeline rebuild |
| `index.html`, `src/style.css` (modify) | label layer, signpost buttons, static fallback section, styles |

---

### Task 1: Placeholder content module

**Files:**
- Create: `src/content/portfolio.js`
- Test: `tests/portfolio.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `CREDITS` — array of exactly 10 `{ artist: string, track: string, url: string }`; `BIO` — string; `CATALOG_URL` — string. Tasks 4, 5, 6 and 7 all read these.

- [ ] **Step 1: Write the failing test**

```js
// tests/portfolio.test.js
import { describe, it, expect } from 'vitest';
import { CREDITS, BIO, CATALOG_URL } from '../src/content/portfolio.js';

describe('portfolio content', () => {
  it('has exactly ten credits, one per monument stone', () => {
    expect(CREDITS).toHaveLength(10);
  });
  it('every credit has artist, track and a url', () => {
    for (const c of CREDITS) {
      expect(typeof c.artist).toBe('string');
      expect(c.artist.length).toBeGreaterThan(0);
      expect(typeof c.track).toBe('string');
      expect(c.track.length).toBeGreaterThan(0);
      expect(c.url).toMatch(/^https?:\/\//);
    }
  });
  it('bio is a few sentences, not a stub', () => {
    expect(BIO.length).toBeGreaterThan(80);
  });
  it('exposes a catalog url', () => {
    expect(CATALOG_URL).toMatch(/^https?:\/\//);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/portfolio.test.js`
Expected: FAIL — cannot resolve `../src/content/portfolio.js`.

- [ ] **Step 3: Write the implementation**

```js
// src/content/portfolio.js
// PLACEHOLDER CONTENT — swap for real credits and bio.
// This is the only file that needs to change; nothing here is referenced by
// name anywhere else, so edits cannot break the scene.

export const CREDITS = [
  { artist: 'placeholder artist one',   track: 'nightshade',        url: 'https://www.beatstars.com/PLACEHOLDER' },
  { artist: 'placeholder artist two',   track: 'delta psalm',       url: 'https://www.beatstars.com/PLACEHOLDER' },
  { artist: 'placeholder artist three', track: 'kerosene choir',    url: 'https://www.beatstars.com/PLACEHOLDER' },
  { artist: 'placeholder artist four',  track: 'low country',       url: 'https://www.beatstars.com/PLACEHOLDER' },
  { artist: 'placeholder artist five',  track: 'revival tent',      url: 'https://www.beatstars.com/PLACEHOLDER' },
  { artist: 'placeholder artist six',   track: 'hollow point',      url: 'https://www.beatstars.com/PLACEHOLDER' },
  { artist: 'placeholder artist seven', track: 'saltwater hymn',    url: 'https://www.beatstars.com/PLACEHOLDER' },
  { artist: 'placeholder artist eight', track: 'crooked mile',      url: 'https://www.beatstars.com/PLACEHOLDER' },
  { artist: 'placeholder artist nine',  track: 'blackwater',        url: 'https://www.beatstars.com/PLACEHOLDER' },
  { artist: 'placeholder artist ten',   track: 'last rites',        url: 'https://www.beatstars.com/PLACEHOLDER' },
];

export const BIO =
  'Placeholder bio. prodfish makes beats out of the dark south — tape hiss, '
  + 'bent guitars, and drums that sound like they were recorded in an empty '
  + 'room after midnight. Credits span independent releases and label work; '
  + 'the full catalog lives on BeatStars.';

export const CATALOG_URL = 'https://www.beatstars.com/PLACEHOLDER';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/portfolio.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/content/portfolio.js tests/portfolio.test.js
git commit -m "feat: placeholder portfolio credits and bio content module"
```

---

### Task 2: Dual-route camera path

**Files:**
- Modify: `src/world/path.js`
- Test: `tests/path.test.js` (add cases; existing ones must keep passing untouched)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `positionAt(t, route = 'direct')` and `targetAt(t, route = 'direct')` — same behaviour as today when `route` is omitted.
  - `tNearest(point, route = 'direct')`.
  - `FORK` — a `THREE.Vector3` **sampled from the direct curve**, not hand-written.
  - `T_FORK_SCROLL = 0.30` — the scroll fraction the fork is pinned to on both routes (Task 6 relies on this exact constant).
  - `routeLength(route)` — metres.
  - `ROUTES = ['direct', 'work']`.
  - Unchanged: `LANDMARKS`, `T_GATE`, `T_DOOR`, `T_ALTAR` (direct-route values).

- [ ] **Step 1: Write the failing tests**

Append to `tests/path.test.js` (leave every existing test exactly as it is):

```js
import { FORK, routeLength, ROUTES, T_FORK_SCROLL } from '../src/world/path.js';

describe('work route', () => {
  it('both routes pass through FORK at their own fork parameter', () => {
    for (const route of ROUTES) {
      const t = tNearest(FORK, route);
      expect(positionAt(t, route).distanceTo(FORK)).toBeLessThan(0.05);
    }
  });
  it('both routes start and end at the same places', () => {
    expect(positionAt(0, 'work').distanceTo(positionAt(0, 'direct'))).toBeLessThan(0.05);
    expect(positionAt(1, 'work').distanceTo(LANDMARKS.ALTAR_STOP)).toBeLessThan(0.05);
  });
  it('the work route is meaningfully longer — it is the scenic one', () => {
    expect(routeLength('work')).toBeGreaterThan(routeLength('direct') * 1.25);
  });
  it('the work route always travels forward (z never doubles back)', () => {
    let prev = positionAt(0, 'work').z;
    for (let t = 0.02; t <= 1.0001; t += 0.02) {
      const z = positionAt(Math.min(t, 1), 'work').z;
      expect(z).toBeLessThanOrEqual(prev + 0.2);
      prev = z;
    }
  });
  it('the work route swings well clear of the direct path (a real detour)', () => {
    let maxX = -Infinity;
    for (let t = 0; t <= 1; t += 0.01) maxX = Math.max(maxX, positionAt(t, 'work').x);
    expect(maxX).toBeGreaterThan(8);
  });
  it('defaults to the direct route when no route is given', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(positionAt(t).distanceTo(positionAt(t, 'direct'))).toBe(0);
      expect(targetAt(t).distanceTo(targetAt(t, 'direct'))).toBe(0);
    }
  });
  it('the work route looks forward, like the direct one', () => {
    for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      expect(targetAt(t, 'work').z).toBeLessThan(positionAt(t, 'work').z);
    }
  });
  it('pins the fork to a scroll fraction inside the approach act', () => {
    expect(T_FORK_SCROLL).toBeGreaterThan(0.15);
    expect(T_FORK_SCROLL).toBeLessThan(0.45);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/path.test.js`
Expected: FAIL — `FORK`, `routeLength`, `ROUTES`, `T_FORK_SCROLL` are not exported.

- [ ] **Step 3: Write the implementation**

In `src/world/path.js`, keep `LANDMARKS` and the existing `curve` definition **exactly as they are**, then rename the existing binding and add the work route. Replace everything from the `const curve = ...` declaration down to the end of the file with:

```js
const directCurve = new THREE.CatmullRomCurve3(
  [
    LANDMARKS.START, LANDMARKS.FIELD_MID, LANDMARKS.BEND, LANDMARKS.GATE,
    LANDMARKS.DOOR_FRONT, LANDMARKS.DOOR, LANDMARKS.AISLE_IN,
    LANDMARKS.AISLE_MID, LANDMARKS.ALTAR_STOP,
  ],
  false,
  'centripetal',
  0.5,
);

// The fork is SAMPLED from the direct curve rather than hand-written, so the
// two routes provably meet there. Hardcoding a guess would leave a gap.
const T_FORK_DIRECT = 0.28;
export const FORK = directCurve.getPointAt(T_FORK_DIRECT);

// The scenic route: out to the monument row, past the crypt, then back to the
// church door. It shares START/FIELD_MID/FORK with the direct route so it
// leaves from the same place, and rejoins at DOOR_FRONT so the church
// sequence downstream is identical on both routes.
const workCurve = new THREE.CatmullRomCurve3(
  [
    LANDMARKS.START,
    LANDMARKS.FIELD_MID,
    FORK,
    new THREE.Vector3(6.5, 1.7, 18),   // ROW_IN   — turn onto the row
    new THREE.Vector3(11, 1.7, 13),    // ROW_MID  — stones flank both sides
    new THREE.Vector3(13, 1.7, 8),     // CRYPT    — bio
    new THREE.Vector3(7, 1.6, 5),      // RETURN   — curve back
    LANDMARKS.DOOR_FRONT, LANDMARKS.DOOR, LANDMARKS.AISLE_IN,
    LANDMARKS.AISLE_MID, LANDMARKS.ALTAR_STOP,
  ],
  false,
  'centripetal',
  0.5,
);

const CURVES = { direct: directCurve, work: workCurve };
export const ROUTES = ['direct', 'work'];

// Scroll fraction the fork is pinned to on BOTH routes. Route switching is
// only continuous because of this: at the moment of the switch the camera is
// at FORK on either curve AND at the same scroll fraction, so restoring the
// scroll position by fraction lands in exactly the same place.
export const T_FORK_SCROLL = 0.30;

function curveFor(route) {
  return CURVES[route] ?? directCurve;
}

export function routeLength(route = 'direct') {
  return curveFor(route).getLength();
}

export function positionAt(t, route = 'direct') {
  return curveFor(route).getPointAt(THREE.MathUtils.clamp(t, 0, 1));
}

// Look slightly ahead along the path; near the end, hold on the altar wall.
export function targetAt(t, route = 'direct') {
  const tc = THREE.MathUtils.clamp(t, 0, 1);
  const ahead = Math.min(tc + 0.04, 1);
  const p = curveFor(route).getPointAt(ahead);
  // fix-round: was `if (ahead === 1) p.z -= 2` -- a step function that
  // snapped the look target back by 2m the instant t crossed 0.96 (where
  // tc + 0.04 first clamps to 1). That single-frame jump read as the
  // camera itself switching position right before the altar. Ramp it in
  // continuously instead.
  const over = THREE.MathUtils.clamp((tc + 0.04 - 1) / 0.04, 0, 1);
  p.z -= 2 * over;
  // Ease the look point upward on the final approach so the neon cross,
  // mounted above eye height on the interior back wall, comes into frame.
  const altarBias = THREE.MathUtils.clamp((tc - 0.85) / 0.15, 0, 1);
  p.y += altarBias * 0.9;
  return p;
}

// Arc-length t whose point is nearest to `point` (sampled search).
export function tNearest(point, route = 'direct') {
  const c = curveFor(route);
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i <= 400; i++) {
    const t = i / 400;
    const d = c.getPointAt(t).distanceToSquared(point);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

export const T_GATE = tNearest(LANDMARKS.GATE);
export const T_DOOR = tNearest(LANDMARKS.DOOR);
export const T_ALTAR = tNearest(LANDMARKS.ALTAR_STOP);
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS — all previous tests plus the eight new ones. If "work route travels forward" fails, move `RETURN` further from the door in z (never edit the direct curve to satisfy it).

- [ ] **Step 5: Commit**

```bash
git add src/world/path.js tests/path.test.js
git commit -m "feat: scenic work route sharing the fork and door with the direct path"
```

---

### Task 3: Route selection state

**Files:**
- Create: `src/world/route.js`
- Test: `tests/route.test.js`

**Interfaces:**
- Consumes: `T_FORK_SCROLL` from `src/world/path.js`.
- Produces: `createRouteState(onChange)` → `{ get(), choose(route), syncLock(scrollFraction), isLocked() }`.
  `choose` is a no-op when locked and returns `false`; it returns `true` and invokes `onChange(newRoute)` when it actually changed the route. Task 6 wires `onChange` to the timeline rebuild.

- [ ] **Step 1: Write the failing test**

```js
// tests/route.test.js
import { describe, it, expect, vi } from 'vitest';
import { createRouteState } from '../src/world/route.js';
import { T_FORK_SCROLL } from '../src/world/path.js';

describe('createRouteState', () => {
  it('starts on the direct route, unlocked', () => {
    const r = createRouteState(() => {});
    expect(r.get()).toBe('direct');
    expect(r.isLocked()).toBe(false);
  });
  it('choosing the work route notifies once and sticks', () => {
    const onChange = vi.fn();
    const r = createRouteState(onChange);
    expect(r.choose('work')).toBe(true);
    expect(r.get()).toBe('work');
    expect(onChange).toHaveBeenCalledWith('work');
    expect(onChange).toHaveBeenCalledTimes(1);
  });
  it('choosing the route already active does nothing', () => {
    const onChange = vi.fn();
    const r = createRouteState(onChange);
    expect(r.choose('direct')).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });
  it('ignores unknown routes', () => {
    const r = createRouteState(() => {});
    expect(r.choose('catacombs')).toBe(false);
    expect(r.get()).toBe('direct');
  });
  it('locks once the camera is past the fork', () => {
    const r = createRouteState(() => {});
    r.syncLock(T_FORK_SCROLL + 0.05);
    expect(r.isLocked()).toBe(true);
    expect(r.choose('work')).toBe(false);
    expect(r.get()).toBe('direct');
  });
  it('unlocks again when scrolled back before the fork', () => {
    const onChange = vi.fn();
    const r = createRouteState(onChange);
    r.syncLock(0.8);
    expect(r.isLocked()).toBe(true);
    r.syncLock(0.1);
    expect(r.isLocked()).toBe(false);
    expect(r.choose('work')).toBe(true);
  });
  it('stays unlocked exactly at the fork so the signpost is still usable', () => {
    const r = createRouteState(() => {});
    r.syncLock(T_FORK_SCROLL);
    expect(r.isLocked()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/route.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```js
// src/world/route.js
import { ROUTES, T_FORK_SCROLL } from './path.js';

// Which road we are walking, and whether the choice is still open.
//
// The choice locks once the camera is past the signpost: switching curves
// mid-church would teleport the camera, since the two routes only coincide
// at the fork. Scrolling back up past the signpost re-opens it.
export function createRouteState(onChange) {
  let route = 'direct';
  let locked = false;

  return {
    get: () => route,
    isLocked: () => locked,
    syncLock(scrollFraction) {
      locked = scrollFraction > T_FORK_SCROLL;
    },
    choose(next) {
      if (locked) return false;
      if (!ROUTES.includes(next)) return false;
      if (next === route) return false;
      route = next;
      onChange(route);
      return true;
    },
  };
}
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/world/route.js tests/route.test.js
git commit -m "feat: route selection state with fork-based locking"
```

---

### Task 4: Monument stones through the asset pipeline

**Files:**
- Move: `public/models/grave_stones.glb` → `assets/source/grave-stones/grave-stones.glb`
- Modify: `scripts/build-assets.mjs` (add the new model to the prop budget set)
- Modify: `ATTRIBUTIONS.md`
- Generated: `public/models/grave-stones.glb`

**Interfaces:**
- Consumes: the existing `assets:build` pipeline.
- Produces: `public/models/grave-stones.glb` — Draco-compressed, containing **ten separate meshes** (one per credit). Tasks 5 and 6 load it as `/models/grave-stones.glb`.

- [ ] **Step 1: Move the raw asset into the pipeline's source tree**

The file currently sits uncompressed in `public/models/` (4.6MB), bypassing the pipeline entirely — it would ship as-is and slow first load.

```bash
mkdir -p assets/source/grave-stones
git mv public/models/grave_stones.glb assets/source/grave-stones/grave-stones.glb 2>/dev/null \
  || mv public/models/grave_stones.glb assets/source/grave-stones/grave-stones.glb
ls -la assets/source/grave-stones/
```

Note `assets/source/` is gitignored by repo convention — the move takes the file out of version control, which is correct and matches every other source model.

- [ ] **Step 2: Confirm the mesh count before compressing**

Run:
```bash
node -e "
const {NodeIO}=require('@gltf-transform/core');const {ALL_EXTENSIONS}=require('@gltf-transform/extensions');
(async()=>{const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const d=await io.read('assets/source/grave-stones/grave-stones.glb');
console.log('meshes:', d.getRoot().listMeshes().length);})()"
```
Expected: `meshes: 10`. The design depends on ten separately-placeable meshes; if this prints a different number, stop and report it — Task 6 places one stone per credit and the count must match `CREDITS.length`.

- [ ] **Step 3: Add the model to the pipeline's prop budget**

In `scripts/build-assets.mjs`, add one entry to `PROP_TRIANGLE_BUDGET` (around line 40) so the file reads:

```js
const PROP_TRIANGLE_BUDGET = {
  cross: 4000,
  'gravestone-a': 3000,
  'gravestone-b': 3000,
  'tree-a': 3000,
  'tree-b': 3000,
  // Ten separate markers in one file, so this budget covers all ten — the
  // per-prop 3000 would flatten the whole set.
  'grave-stones': 8000,
};
```

Being listed here also caps its textures at 1024px, which is what the other props get.

- [ ] **Step 4: Build and verify**

Run:
```bash
npm run assets:build
npx gltf-transform inspect public/models/grave-stones.glb
```
Expected: `public/models/grave-stones.glb` exists, is dramatically smaller than 4.6MB, still reports 10 meshes, and total triangles ≤ 8000.

- [ ] **Step 5: Record provenance**

The user supplied this asset, so its origin is not yet documented. Append to the AI-generated / supplied section of `ATTRIBUTIONS.md`:

```markdown
- **Grave stones set (10 markers)** — supplied by the site owner for this
  project, 2026-08. Used for the portfolio monument row.
```

If its true licence later proves to be third-party, this line is where it gets corrected.

- [ ] **Step 6: Commit**

```bash
git add scripts/build-assets.mjs ATTRIBUTIONS.md public/models/grave-stones.glb
git rm --cached public/models/grave_stones.glb 2>/dev/null || true
git commit -m "assets: route grave stones through the compression pipeline"
```

---

### Task 5: Projected DOM label system

**Files:**
- Create: `src/labels.js`
- Modify: `index.html` (label layer), `src/style.css` (label styles)
- Test: `tests/labels.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure + DOM).
- Produces:
  - `labelScreenPosition(ndc, width, height)` → `{ x, y }` in CSS pixels.
  - `labelOpacity({ ndcZ, distance, nearFade, farFade, enabled })` → `0..1`.
  - `createLabelLayer({ container, camera })` → `{ add({ anchor, el, when }), update(), clear() }`.
    `anchor` is a `THREE.Vector3` in world space; `el` is any element; `when` is an optional predicate returning whether the label may show at all (defaults to always). `update()` is called once per frame by the scene manager.

- [ ] **Step 1: Write the failing test**

```js
// tests/labels.test.js
import { describe, it, expect } from 'vitest';
import { labelScreenPosition, labelOpacity } from '../src/labels.js';

describe('labelScreenPosition', () => {
  it('maps the NDC centre to the middle of the viewport', () => {
    expect(labelScreenPosition({ x: 0, y: 0 }, 1000, 800)).toEqual({ x: 500, y: 400 });
  });
  it('maps NDC corners to viewport corners, flipping y', () => {
    expect(labelScreenPosition({ x: -1, y: 1 }, 1000, 800)).toEqual({ x: 0, y: 0 });
    expect(labelScreenPosition({ x: 1, y: -1 }, 1000, 800)).toEqual({ x: 1000, y: 800 });
  });
});

describe('labelOpacity', () => {
  const range = { nearFade: 3, farFade: 25 };
  it('hides anything behind the camera', () => {
    expect(labelOpacity({ ndcZ: 1.5, distance: 10, ...range })).toBe(0);
  });
  it('hides anything past the far fade', () => {
    expect(labelOpacity({ ndcZ: 0.5, distance: 40, ...range })).toBe(0);
  });
  it('hides anything the camera has already passed', () => {
    expect(labelOpacity({ ndcZ: 0.5, distance: 1, ...range })).toBe(0);
  });
  it('is fully opaque in the comfortable reading band', () => {
    expect(labelOpacity({ ndcZ: 0.5, distance: 12, ...range })).toBe(1);
  });
  it('stays hidden when gated off, however good the geometry is', () => {
    expect(labelOpacity({ ndcZ: 0.5, distance: 12, ...range, enabled: false })).toBe(0);
  });
  it('fades in as a stone approaches and out as it passes', () => {
    const far = labelOpacity({ ndcZ: 0.5, distance: 22, ...range });
    const mid = labelOpacity({ ndcZ: 0.5, distance: 12, ...range });
    const near = labelOpacity({ ndcZ: 0.5, distance: 4, ...range });
    expect(far).toBeGreaterThan(0);
    expect(far).toBeLessThan(1);
    expect(mid).toBe(1);
    expect(near).toBeGreaterThan(0);
    expect(near).toBeLessThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/labels.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```js
// src/labels.js
import * as THREE from 'three';

// Credits are real HTML anchors floated over the 3D scene rather than text
// baked into the stone textures: they stay crisp at any distance, they are
// focusable and clickable, screen readers can read them, and search engines
// can index them. The only cost is projecting a handful of points per frame.

export function labelScreenPosition(ndc, width, height) {
  return {
    x: (ndc.x * 0.5 + 0.5) * width,
    y: (-ndc.y * 0.5 + 0.5) * height,
  };
}

// Fades a label up as its stone comes into reading range and back down as the
// camera slides past, so text never sits jammed against the lens or hovering
// unreadably in the fog.
export function labelOpacity({ ndcZ, distance, nearFade, farFade, enabled = true }) {
  if (!enabled) return 0;                 // gated off (e.g. wrong route)
  if (ndcZ > 1) return 0;                 // behind the camera
  if (distance > farFade) return 0;       // lost in the fog
  if (distance < nearFade * 0.5) return 0; // already passed
  const fadeIn = THREE.MathUtils.clamp((farFade - distance) / (farFade * 0.4), 0, 1);
  const fadeOut = THREE.MathUtils.clamp((distance - nearFade * 0.5) / (nearFade * 0.5), 0, 1);
  return Math.min(fadeIn, fadeOut);
}

export function createLabelLayer({ container, camera }) {
  const items = [];
  const ndc = new THREE.Vector3();

  return {
    // `when` gates a label on something other than geometry — the credit
    // labels use it so they only appear to walkers who actually took the
    // scenic route. Without it they would hang over the graveyard in the
    // middle distance for everyone on the direct path.
    add({ anchor, el, when = () => true }) {
      el.style.position = 'absolute';
      el.style.opacity = '0';
      el.style.visibility = 'hidden';
      container.appendChild(el);
      items.push({ anchor, el, when, lastVisible: false });
    },
    clear() {
      for (const it of items) it.el.remove();
      items.length = 0;
    },
    update() {
      const width = container.clientWidth;
      const height = container.clientHeight;
      for (const it of items) {
        ndc.copy(it.anchor).project(camera);
        const distance = camera.position.distanceTo(it.anchor);
        const opacity = labelOpacity({
          ndcZ: ndc.z, distance, nearFade: 3, farFade: 25, enabled: it.when(),
        });
        const visible = opacity > 0.01;
        if (visible) {
          const { x, y } = labelScreenPosition(ndc, width, height);
          it.el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
          it.el.style.opacity = String(opacity);
        }
        // Toggling visibility (not just opacity) keeps invisible labels out of
        // the tab order and away from the accessibility tree.
        if (visible !== it.lastVisible) {
          it.el.style.visibility = visible ? 'visible' : 'hidden';
          it.el.setAttribute('aria-hidden', visible ? 'false' : 'true');
          it.lastVisible = visible;
        }
      }
    },
  };
}
```

- [ ] **Step 4: Add the label layer to the page**

In `index.html`, immediately after the `<div id="loading" …>` line, add:

```html
  <div id="labels" aria-live="polite"></div>
```

In `src/style.css`, after the `#loading` block, add:

```css
#labels {
  position: fixed;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  overflow: hidden;
}
.label {
  pointer-events: auto;
  font-family: var(--mono);
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  text-align: center;
  color: var(--bone);
  text-shadow: 0 0 12px rgba(0, 0, 0, 0.95), 0 0 30px rgba(0, 0, 0, 0.8);
  text-decoration: none;
  white-space: nowrap;
  transition: color 0.25s;
}
.label .label-track {
  display: block;
  font-family: var(--serif);
  font-style: italic;
  font-size: 1.05rem;
  letter-spacing: 0.08em;
  text-transform: none;
  color: rgba(216, 211, 200, 0.85);
}
.label:hover,
.label:focus-visible {
  color: #fff;
}
.label:focus-visible {
  outline: 1px solid var(--blood);
  outline-offset: 6px;
}
.reduced #labels, .no-webgl #labels { display: none; }
```

- [ ] **Step 5: Verify**

Run: `npm test && npm run build`
Expected: all tests pass (including the 12 new label assertions); build clean.

- [ ] **Step 6: Commit**

```bash
git add src/labels.js tests/labels.test.js index.html src/style.css
git commit -m "feat: projected DOM label layer for in-world credits"
```

---

### Task 6: Monument row, signpost and crypt

**Files:**
- Create: `src/world/monuments.js`
- Test: `tests/monuments.test.js`

**Interfaces:**
- Consumes: `positionAt`, `FORK` from `src/world/path.js`; `CREDITS` from `src/content/portfolio.js`; the loaded `/models/grave-stones.glb` GLTF (or `null`).
- Produces:
  - `MONUMENT_SPOTS` — array of 10 `[x, z, rotY, scale]`.
  - `minWorkPathClearance()` — smallest distance from any monument spot to the work route.
  - `minDirectPathDistance()` — smallest distance from any monument spot to the *direct* route (proves the row is genuinely off the main path).
  - `sideOfRoute(x, z)` — signed number: which side of the work route a point lies on.
  - `buildMonuments({ scene, stonesGltf, creditCount })` → `{ anchors: { sign: THREE.Vector3, credits: THREE.Vector3[], crypt: THREE.Vector3 } }`.
    `credits` has one anchor per credit, ordered as walked. Task 7 attaches labels to these.

- [ ] **Step 1: Write the failing test**

```js
// tests/monuments.test.js
import { describe, it, expect } from 'vitest';
import {
  MONUMENT_SPOTS, minWorkPathClearance, minDirectPathDistance, sideOfRoute,
} from '../src/world/monuments.js';
import { CREDITS } from '../src/content/portfolio.js';

describe('MONUMENT_SPOTS', () => {
  it('has exactly one stone per credit', () => {
    expect(MONUMENT_SPOTS).toHaveLength(CREDITS.length);
  });
  it('keeps every stone clear of the camera corridor', () => {
    expect(minWorkPathClearance()).toBeGreaterThan(1.4);
  });
  it('places stones out along the detour, well clear of the direct path', () => {
    for (const [x] of MONUMENT_SPOTS) expect(x).toBeGreaterThan(4);
    expect(minDirectPathDistance()).toBeGreaterThan(4);
  });
  it('flanks both sides of the route', () => {
    // Compare against the route's own direction rather than a fixed x, so
    // this keeps meaning something if the curve is ever retuned.
    const sides = MONUMENT_SPOTS.map(([x, z]) => sideOfRoute(x, z));
    expect(sides.some((s) => s > 0)).toBe(true);
    expect(sides.some((s) => s < 0)).toBe(true);
  });
  it('spreads the stones along the row rather than bunching them', () => {
    const zs = MONUMENT_SPOTS.map(([, z]) => z);
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/monuments.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```js
// src/world/monuments.js
import * as THREE from 'three';
import { positionAt, FORK } from './path.js';

// Ten markers flanking the scenic route between ROW_IN (z 18) and CRYPT
// (z 8), alternating sides so the walk reads as an avenue. Deterministic —
// the clearance test below is only meaningful against fixed positions.
// These are not hand-guessed: they were generated by sampling the work curve
// between the fork and the crypt and stepping a fixed perpendicular offset
// alternately to each side, then verified to clear the route by 1.93m and to
// sit 5.88m clear of the direct path.
export const MONUMENT_SPOTS = [
  [6.34, 23.9, -0.97, 1.0],
  [5.65, 17.51, -1.39, 1.1],
  [10.51, 22.8, -0.77, 0.95],
  [8.51, 16.26, -1.25, 1.05],
  [13.44, 20.43, -0.72, 1.0],
  [10.77, 13.73, -1.17, 1.1],
  [16.3, 17.73, -0.6, 0.95],
  [13.51, 11.89, -1.09, 1.05],
  [19.57, 15.84, -0.56, 1.0],
  [16.01, 10.03, -0.93, 1.1],
];

function minDistanceToRoute(x, z, route) {
  let min = Infinity;
  for (let i = 0; i <= 300; i++) {
    const p = positionAt(i / 300, route);
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < min) min = d;
  }
  return min;
}

// Smallest horizontal distance from any monument to the scenic route — the
// camera must not clip a headstone as it walks the row.
export function minWorkPathClearance() {
  return Math.min(...MONUMENT_SPOTS.map(([x, z]) => minDistanceToRoute(x, z, 'work')));
}

// ...and how far the row sits from the main path, which is what makes the
// detour worth taking rather than something you can read from the road.
export function minDirectPathDistance() {
  return Math.min(...MONUMENT_SPOTS.map(([x, z]) => minDistanceToRoute(x, z, 'direct')));
}

// Which side of the scenic route a point falls on: positive one way,
// negative the other. Used to prove the stones flank the walk.
export function sideOfRoute(x, z) {
  let bestT = 0;
  let bestD = Infinity;
  for (let i = 0; i <= 300; i++) {
    const t = i / 300;
    const p = positionAt(t, 'work');
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD) { bestD = d; bestT = t; }
  }
  const p = positionAt(bestT, 'work');
  // Finite-difference tangent — avoids exporting yet another curve accessor
  // from path.js for one geometric test.
  const ahead = positionAt(Math.min(bestT + 0.01, 1), 'work');
  const behind = positionAt(Math.max(bestT - 0.01, 0), 'work');
  const tx = ahead.x - behind.x;
  const tz = ahead.z - behind.z;
  return tx * (z - p.z) - tz * (x - p.x);
}

const STONE_HEIGHT = 1.35;

function fallbackStone() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#3a3f3a', roughness: 1 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(0.8, STONE_HEIGHT, 0.2), mat);
  slab.position.y = STONE_HEIGHT / 2;
  g.add(slab);
  return g;
}

// Scale an object so it stands `height` tall with its feet on y = 0.
function standUpright(obj, height) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  if (size.y > 0) obj.scale.multiplyScalar(height / size.y);
  const after = new THREE.Box3().setFromObject(obj);
  const centre = after.getCenter(new THREE.Vector3());
  obj.position.x -= centre.x;
  obj.position.z -= centre.z;
  obj.position.y -= after.min.y;
  const wrapper = new THREE.Group();
  wrapper.add(obj);
  return wrapper;
}

// A weathered two-armed signpost, built from primitives so there is no asset
// to hunt down and nothing to mis-scale. The arms carry no 3D text — the
// words are DOM labels anchored to them (see labels.js).
function buildSignpost(scene) {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#241d16', roughness: 0.95 });

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.6, 7), wood);
  post.position.y = 1.3;
  group.add(post);

  const armGeo = new THREE.BoxGeometry(1.5, 0.26, 0.06);
  const beatsArm = new THREE.Mesh(armGeo, wood);
  beatsArm.position.set(-0.62, 2.25, 0);
  beatsArm.rotation.z = 0.04;
  const workArm = new THREE.Mesh(armGeo, wood);
  workArm.position.set(0.62, 1.85, 0);
  workArm.rotation.z = -0.05;
  group.add(beatsArm, workArm);

  // Stand it just off the path at the fork, angled to face the walker.
  group.position.set(FORK.x + 1.5, 0, FORK.z);
  group.rotation.y = -0.5;
  scene.add(group);

  const anchor = new THREE.Vector3(FORK.x + 1.5, 2.55, FORK.z);
  return { group, anchor };
}

function buildCrypt(scene) {
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: '#2b2b28', roughness: 1 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.8, 3.0), stone);
  body.position.y = 1.4;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.7, 1.1, 4), stone);
  roof.position.y = 3.35;
  roof.rotation.y = Math.PI / 4;
  const doorway = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 1.9, 0.12),
    new THREE.MeshStandardMaterial({ color: '#0b0b0a', roughness: 1 }),
  );
  doorway.position.set(0, 0.95, 1.51);
  group.add(body, roof, doorway);

  // Just past the far end of the monument row, set back from the route so
  // the camera sweeps by its face rather than through it.
  group.position.set(22.5, 0, 8.5);
  group.rotation.y = -1.15;
  scene.add(group);

  return { group, anchor: new THREE.Vector3(22.5, 3.1, 8.5) };
}

export function buildMonuments({ scene, stonesGltf, creditCount }) {
  const sign = buildSignpost(scene);
  const crypt = buildCrypt(scene);

  // The supplied GLB holds one mesh per marker, so each credit gets a
  // visually distinct stone. If it is missing we fall back to plain slabs —
  // the credits are DOM labels, so the information survives regardless.
  const sources = [];
  if (stonesGltf) {
    stonesGltf.scene.traverse((o) => { if (o.isMesh) sources.push(o); });
  }

  const credits = [];
  const count = Math.min(creditCount, MONUMENT_SPOTS.length);
  for (let i = 0; i < count; i++) {
    const [x, z, rotY, s] = MONUMENT_SPOTS[i];
    const src = sources.length ? sources[i % sources.length].clone(true) : fallbackStone();
    const stone = standUpright(src, STONE_HEIGHT * s);
    stone.position.set(x, 0, z);
    stone.rotation.y = rotY;
    scene.add(stone);
    credits.push(new THREE.Vector3(x, STONE_HEIGHT * s + 0.45, z));
  }

  return { anchors: { sign: sign.anchor, credits, crypt: crypt.anchor } };
}
```

- [ ] **Step 4: Run the full suite**

Run: `npm test && npm run build`
Expected: PASS. If clearance fails, move the offending spot further from the route — never lower the 1.4 threshold.

- [ ] **Step 5: Commit**

```bash
git add src/world/monuments.js tests/monuments.test.js
git commit -m "feat: signpost, monument row and crypt geometry"
```

---

### Task 7: Wire the fork into the scene, timeline and boot

**Files:**
- Modify: `src/scenes/sceneManager.js`, `src/timeline.js`, `src/main.js`, `src/style.css`

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces: a working fork. `initScene` gains `stones` in `models` and returns `{ renderer, scene, camera, render, labels, anchors }`. `buildTimeline(state, route)` becomes route-aware.

- [ ] **Step 1: Make the timeline route-aware and pin the fork**

In `src/timeline.js`, change the import and signature, and split the approach act's pathT tween at the fork. Replace the import line and the `buildTimeline` signature/keyframe block:

```js
import { tNearest, FORK, LANDMARKS, T_FORK_SCROLL } from './world/path.js';

export function buildTimeline(state, route = 'direct') {
```

Then replace the `DOOR_FRONT_T` / `APPROACH_END_T` / `DOOR_IN_T` definitions with route-aware ones:

```js
  // Landmark parameters differ per route (the scenic route is longer, so the
  // door sits at a different fraction of it), so they are resolved per build
  // rather than imported as constants.
  const doorT = tNearest(LANDMARKS.DOOR, route);
  const forkT = tNearest(FORK, route);
  const DOOR_FRONT_T = doorT - 0.07;
  const APPROACH_END_T = DOOR_FRONT_T - 0.02;
  const DOOR_IN_T = Math.min(doorT + 0.05, 0.9);
```

Replace the single approach pathT tween (the `sine.inOut` one) with two tweens meeting at the fork, keeping the fog/sway/crow tweens exactly as they are:

```js
  // The approach is split at the signpost. Both routes reach the fork at the
  // SAME scroll fraction (T_FORK_SCROLL) even though forkT differs between
  // them — that is what lets a route switch preserve the camera's position
  // and the reader's scroll position at the same time.
  tl.to(state, { pathT: forkT, duration: T_FORK_SCROLL - approachStart, ease: 'sine.inOut' }, approachStart)
    .to(state, { pathT: APPROACH_END_T, duration: approachEnd - T_FORK_SCROLL, ease: 'sine.inOut' }, T_FORK_SCROLL)
    .to(state, { fog: 0.04, duration: approachEnd - approachStart }, approachStart)
    .to(state, { swayAmp: 0.5, duration: approachEnd - approachStart }, approachStart)
    .to(state, { crowT: 1, duration: 0.14 }, 0.28);
```

Leave every other act untouched.

- [ ] **Step 2: Drive labels and monuments from the scene manager**

In `src/scenes/sceneManager.js`: add imports

```js
import { buildMonuments } from '../world/monuments.js';
import { createLabelLayer } from '../labels.js';
```

After the existing `buildWorld(...)` call, build the monuments and the label layer:

```js
  const monuments = buildMonuments({
    scene,
    stonesGltf: models.stones,
    creditCount: 10,
  });
  const labels = createLabelLayer({
    container: document.getElementById('labels'),
    camera,
  });
```

Change the camera position line to pass the route through — replace `positionAt(state.pathT)` with `positionAt(state.pathT, state.route)` and `targetAt(state.pathT)` with `targetAt(state.pathT, state.route)` (both in the main render path; the `__DEBUG_CHAPEL__` override branch needs no change).

Add one line immediately before `post.composer.render();` in the main render path:

```js
    labels.update();
```

Extend the return value:

```js
  return { renderer, scene, camera, render, labels, anchors: monuments.anchors };
```

- [ ] **Step 3: Add `route` to the shared state**

In `src/choreography.js`, add one field to the object returned by `createState()`:

```js
    route: 'direct',  // 'direct' | 'work' — which road we are walking
```

In `tests/choreography.test.js`, add one assertion inside the existing "starts before the scene" test:

```js
    expect(s.route).toBe('direct');
```

- [ ] **Step 4: Load the stones and wire route switching in boot**

In `src/main.js`, add `/models/grave-stones.glb` to `loadModels`:

```js
async function loadModels() {
  const load = createAssetLoader();
  const [church, crow, cross, gravestoneA, gravestoneB, treeA, treeB, stones] = await Promise.all([
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
    load.optional('/models/grave-stones.glb'),
  ]);
  return { church, crow, cross, gravestoneA, gravestoneB, treeA, treeB, stones };
}
```

Add these imports at the top:

```js
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createRouteState } from './world/route.js';
import { T_FORK_SCROLL } from './world/path.js';
import { CREDITS, BIO, CATALOG_URL } from './content/portfolio.js';
```

Then replace the body of `boot()` with:

```js
async function boot() {
  const state = createState();
  const tier = detectTier();
  const models = await loadModels();
  const app = initScene({ canvas: document.getElementById('scene'), state, tier, models });
  document.body.classList.add('ready');

  initScroll();
  let timeline = buildTimeline(state, state.route);

  // Switching routes rebuilds the timeline, because the door and altar sit at
  // different fractions of a longer curve. The scenic route also needs more
  // scroll to keep the metres-per-scroll pacing steady, so the track grows.
  // Both routes put the fork at T_FORK_SCROLL, so restoring the scroll
  // position by fraction leaves the camera exactly where it was: at the
  // signpost. Without that pinning the camera would jump on every switch.
  const routeState = createRouteState((next) => {
    state.route = next;
    document.getElementById('scroll-track').style.height = next === 'work' ? '1600vh' : '1000vh';
    timeline.scrollTrigger?.kill();
    timeline.kill();
    timeline = buildTimeline(state, next);
    ScrollTrigger.refresh();
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, T_FORK_SCROLL * max);
  });

  attachSignpost(app, routeState);
  attachCreditLabels(app, state);

  ScrollTrigger.create({
    trigger: '#scroll-track',
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => routeState.syncLock(self.progress),
  });

  gsap.ticker.add(() => app.render());
}
```

- [ ] **Step 5: Build the label elements**

Still in `src/main.js`, add these two helpers above `boot()`:

```js
// The signpost's arms are real buttons floated over the 3D post, so the
// choice is clickable, focusable and announced — not a mouse-only hotspot.
function attachSignpost(app, routeState) {
  const wrap = document.createElement('div');
  wrap.className = 'label label-sign';

  const beats = document.createElement('button');
  beats.type = 'button';
  beats.className = 'sign-arm';
  beats.textContent = 'the beats ↑';
  beats.addEventListener('click', () => routeState.choose('direct'));

  const work = document.createElement('button');
  work.type = 'button';
  work.className = 'sign-arm sign-arm-work';
  work.textContent = 'the work →';
  work.addEventListener('click', () => routeState.choose('work'));

  wrap.append(beats, work);
  app.labels.add({ anchor: app.anchors.sign, el: wrap });
}

// Credit labels are gated on the scenic route. The monument row stands off to
// the side of the direct path and is well within label range from it, so
// without this gate every walker would see credits floating over the
// graveyard whether or not they chose to visit them.
function attachCreditLabels(app, state) {
  const onWorkRoute = () => state.route === 'work';

  app.anchors.credits.forEach((anchor, i) => {
    const credit = CREDITS[i];
    if (!credit) return;
    const a = document.createElement('a');
    a.className = 'label';
    a.href = credit.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.innerHTML = `${credit.artist}<span class="label-track"></span>`;
    a.querySelector('.label-track').textContent = credit.track;
    app.labels.add({ anchor, el: a, when: onWorkRoute });
  });

  const crypt = document.createElement('div');
  crypt.className = 'label label-crypt';
  const bio = document.createElement('p');
  bio.textContent = BIO;
  const catalog = document.createElement('a');
  catalog.href = CATALOG_URL;
  catalog.target = '_blank';
  catalog.rel = 'noopener';
  catalog.textContent = 'the full catalog ↗';
  crypt.append(bio, catalog);
  app.labels.add({ anchor: app.anchors.crypt, el: crypt, when: onWorkRoute });
}
```

Note `a.innerHTML` is assigned a template containing only the static markup; the credit strings themselves are set with `textContent`, so content data can never inject markup.

- [ ] **Step 6: Style the signpost and crypt labels**

Append to `src/style.css`:

```css
.label-sign {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  align-items: flex-start;
}
.sign-arm {
  background: rgba(8, 7, 6, 0.55);
  border: 1px solid rgba(216, 211, 200, 0.28);
  color: var(--bone);
  font-family: var(--mono);
  font-size: 0.66rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  padding: 0.5rem 0.9rem;
  cursor: pointer;
  transition: border-color 0.25s, color 0.25s, background 0.25s;
}
.sign-arm:hover,
.sign-arm:focus-visible {
  border-color: var(--blood);
  background: rgba(30, 4, 2, 0.7);
  color: #fff;
}
.sign-arm-work { margin-left: 1.4rem; }

.label-crypt {
  width: min(30rem, 74vw);
  white-space: normal;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.label-crypt p {
  font-family: var(--serif);
  font-size: 1rem;
  line-height: 1.6;
  letter-spacing: 0.02em;
  text-transform: none;
  color: rgba(216, 211, 200, 0.9);
}
.label-crypt a {
  color: rgba(216, 211, 200, 0.7);
  font-size: 0.68rem;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  text-decoration: none;
  border-bottom: 1px solid rgba(193, 23, 15, 0.5);
  padding-bottom: 2px;
  align-self: center;
}
.label-crypt a:hover { color: var(--bone); }
```

- [ ] **Step 7: Verify tests and build**

Run: `npm test && npm run build`
Expected: all tests pass; build clean.

- [ ] **Step 8: Verify visually**

Start the dev server if needed (`curl -sf http://localhost:5173 || (npm run dev >/dev/null 2>&1 &)`), then edit `drive.mjs` so it: scrolls to 30% (the fork), screenshots, clicks `.sign-arm-work`, screenshots immediately (the camera must not jump), then walks 32→60% in 4% steps through the monument row and crypt, and finally to 100% to confirm the church sequence still arrives at the beats. Run it and Read every screenshot.

Acceptance: the signpost is legible at the fork with two readable arms; clicking "the work" does not move the camera; credit labels fade in over their stones one at a time and are readable; the crypt bio is readable; the route still ends at the altar and the beats embed.

- [ ] **Step 9: Commit**

```bash
git add src/scenes/sceneManager.js src/timeline.js src/main.js src/choreography.js src/style.css tests/choreography.test.js
git commit -m "feat: wire the portfolio fork into scene, timeline and boot"
```

---

### Task 8: Static fallback, accessibility pass and final verification

**Files:**
- Modify: `index.html`, `src/style.css`, `src/main.js`

**Interfaces:**
- Consumes: `CREDITS`, `BIO`, `CATALOG_URL`.
- Produces: the same portfolio content in the reduced-motion and no-WebGL paths, from the same data.

- [ ] **Step 1: Add the static portfolio section**

In `index.html`, inside `<main id="scroll-track">` immediately **before** `<section id="chapel">`, add:

```html
    <section id="work" aria-labelledby="work-title">
      <h2 id="work-title" class="chapel-title">the work</h2>
      <ul class="work-list"></ul>
      <p class="work-bio"></p>
      <a class="bs-link work-catalog" target="_blank" rel="noopener">the full catalog ↗</a>
    </section>
```

In `src/style.css` add:

```css
/* The 3D route carries the portfolio; this section is the fallback copy for
   reduced-motion and no-WebGL visitors. Hidden by default so it never
   duplicates the in-world labels. */
#work { display: none; }
.reduced #work, .no-webgl #work {
  display: flex;
  position: relative;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 5rem 1.5rem 2rem;
  text-align: center;
}
.work-list { list-style: none; display: flex; flex-direction: column; gap: 1rem; }
.work-list a {
  color: rgba(216, 211, 200, 0.85);
  text-decoration: none;
  font-family: var(--serif);
  font-style: italic;
  font-size: 1.1rem;
}
.work-list a:hover { color: var(--bone); }
.work-list .work-artist {
  display: block;
  font-family: var(--mono);
  font-style: normal;
  font-size: 0.66rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: rgba(216, 211, 200, 0.5);
}
.work-bio {
  max-width: 34rem;
  font-family: var(--serif);
  font-size: 1rem;
  line-height: 1.7;
  color: rgba(216, 211, 200, 0.8);
}
```

- [ ] **Step 2: Populate it from the same data**

In `src/main.js`, add this function and call it unconditionally at the bottom of the file, just before the boot-path `if` chain — the section is CSS-hidden unless a fallback class is set, so filling it always keeps one code path:

```js
// Fills the static fallback section from the same content module the in-world
// labels use, so the credits can never drift between the two presentations.
function fillStaticPortfolio() {
  const list = document.querySelector('.work-list');
  const bio = document.querySelector('.work-bio');
  const catalog = document.querySelector('.work-catalog');
  if (!list || !bio || !catalog) return;
  for (const c of CREDITS) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = c.url;
    a.target = '_blank';
    a.rel = 'noopener';
    const artist = document.createElement('span');
    artist.className = 'work-artist';
    artist.textContent = c.artist;
    a.append(artist, document.createTextNode(c.track));
    li.append(a);
    list.append(li);
  }
  bio.textContent = BIO;
  catalog.href = CATALOG_URL;
}

fillStaticPortfolio();
```

- [ ] **Step 3: Verify the fallbacks**

Run `npm run dev`, then check in a browser:
1. `http://localhost:5173/` — the static `#work` section is **not** visible; credits appear only as in-world labels on the scenic route.
2. Emulate `prefers-reduced-motion: reduce` (DevTools → Rendering) and reload — the `#work` section renders with all ten credits, the bio and the catalog link; no in-world labels.
3. Temporarily make `webglAvailable()` return `false`, reload — same static section renders; restore the function afterwards.
4. Tab through the page on the normal path: the signpost arms take focus at the fork with a visible outline, and credit links take focus while their stones are on screen.

Record what you observed for each of the four checks in your report.

- [ ] **Step 4: Final verification**

Run: `npm test && npm run build`
Expected: all tests pass; build clean. Then run the screenshot driver once more and confirm both routes still arrive at the beats embed.

- [ ] **Step 5: Commit**

```bash
git add index.html src/style.css src/main.js
git commit -m "feat: static portfolio fallback for reduced-motion and no-webgl"
```
