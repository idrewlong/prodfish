# The Swamp Road Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the short work loop with a road roughly three times the length of the church road, running out through swamp country to a row of gravestones whose song titles are carved into the stone and clickable, then back to the church door.

**Architecture:** The `work` curve in `path.js` is replaced; it still passes through `FORK` and rejoins at `DOOR_FRONT`, so the proven fork-switching and church sequences are untouched. Because a road three times as long cannot inherit the church road's act boundaries, act spans become **route-aware**: the work road gets its own table with a dedicated slow `row` span for the monument walk. Song titles reuse the signpost's engraving and picking machinery rather than introducing a second interaction vocabulary.

**Tech Stack:** three ^0.185.1, gsap ^3.15 + ScrollTrigger, lenis, vite ^8, vitest ^4.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-11-swamp-route-design.md`.
- Branch: `main`, working directly. No pushing to the remote.
- 85 tests currently pass. Never weaken or delete an existing assertion.
- **The `direct` curve and the direct road's act spans must not change.** The user approved that pacing across many rounds.
- **The work curve must still pass through `FORK` and rejoin at `DOOR_FRONT`.** The fork switch depends on both curves meeting at `FORK`; the church sequence depends on the shared tail.
- `T_FORK_SCROLL` stays 0.30 on both routes — the parking and switch machinery is proven and derives from it.
- Measured constants only: monument positions, clearances and road geometry are computed by sampling the curve, never hand-placed. Existing helpers (`minWorkPathClearance`, `minDirectPathDistance`, `sideOfRoute`, `signViewAngleDeg`) are the pattern.
- Out of scope, must not be built here: the rider's building, the character, the motorcycle, the about wall, social links, exit routing. Stage 3 owns those.
- Every task: run `npm test` before committing; commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Visual checks: `cd /private/tmp/claude-501/-Users-idrew-Desktop-git-repo-prodfish/9d973f9c-4036-413b-9dbb-075332062cfc/scratchpad && node drive.mjs` (there are also `verify_sign.mjs` and `verify_candles.mjs` there to copy as templates), then Read the PNGs in `shots/`.

## File Structure

| File | Responsibility |
|---|---|
| `src/world/path.js` (modify) | the longer `work` curve |
| `src/choreography.js` (modify) | route-aware act tables |
| `src/journey.js` (modify) | `JOURNEY_VH.work` sized for the new road |
| `src/timeline.js` (modify) | build from the route's act table; the slow `row` span |
| `src/world/swamp.js` (new) | water, reeds, cypress trunks — the work road's dressing |
| `src/world/monuments.js` (modify) | stones on the new road, titles carved, stones clickable |
| `src/world/world.js` (modify) | dirt path on both roads |
| `src/main.js`, `src/scenes/sceneManager.js` (modify) | wiring; remove floating credit labels |

---

### Task 1: The long road

**Files:**
- Modify: `src/world/path.js`
- Test: `tests/path.test.js` (append only)

**Interfaces:**
- Consumes: nothing.
- Produces: a `work` curve roughly 3× the direct road's length, still through `FORK` and `DOOR_FRONT`. Adds `ROW_START` and `ROW_END` (`THREE.Vector3`) marking where the monument row begins and ends, and `tRow(route)` → `{ start, end }` arc-length parameters for that stretch. Tasks 2 and 4 consume these.

- [ ] **Step 1: Write the failing test**

Append to `tests/path.test.js`:

```js
import { ROW_START, ROW_END, tRow } from '../src/world/path.js';

describe('the long work road', () => {
  it('runs about three times the direct road', () => {
    const ratio = routeLength('work') / routeLength('direct');
    expect(ratio).toBeGreaterThan(2.6);
    expect(ratio).toBeLessThan(3.4);
  });
  it('still meets the direct road at the fork', () => {
    expect(positionAt(tNearest(FORK, 'work'), 'work').distanceTo(FORK)).toBeLessThan(0.05);
  });
  it('still rejoins at the church door', () => {
    expect(positionAt(1, 'work').distanceTo(LANDMARKS.ALTAR_STOP)).toBeLessThan(0.05);
    const tDoorWork = tNearest(LANDMARKS.DOOR, 'work');
    expect(positionAt(tDoorWork, 'work').distanceTo(LANDMARKS.DOOR)).toBeLessThan(0.3);
  });
  it('goes far enough out that the church is genuinely left behind', () => {
    let maxDist = 0;
    for (let t = 0; t <= 1; t += 0.01) {
      const p = positionAt(t, 'work');
      maxDist = Math.max(maxDist, Math.hypot(p.x - LANDMARKS.DOOR.x, p.z - LANDMARKS.DOOR.z));
    }
    expect(maxDist).toBeGreaterThan(45);
  });
  it('never doubles back on itself', () => {
    // Sampled arc-length points must keep moving forward; a curve that
    // reverses would slide the camera backwards mid-scroll.
    let prev = positionAt(0, 'work');
    let travelled = 0;
    for (let t = 0.005; t <= 1.0001; t += 0.005) {
      const p = positionAt(Math.min(t, 1), 'work');
      travelled += p.distanceTo(prev);
      prev = p;
    }
    expect(travelled).toBeCloseTo(routeLength('work'), 0);
  });
  it('marks a monument row well out along the road', () => {
    const { start, end } = tRow('work');
    expect(start).toBeGreaterThan(0.2);
    expect(end).toBeLessThan(0.85);
    expect(end).toBeGreaterThan(start);
    expect(positionAt(start, 'work').distanceTo(ROW_START)).toBeLessThan(0.6);
    expect(positionAt(end, 'work').distanceTo(ROW_END)).toBeLessThan(0.6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/path.test.js`
Expected: FAIL — `ROW_START`, `ROW_END`, `tRow` are not exported.

- [ ] **Step 3: Write the implementation**

In `src/world/path.js`, leave `directCurve`, `FORK`, and every existing export untouched. Replace the `workCurve` control-point list with a longer road and add the row markers:

```js
// The scenic road: out of the graveyard, right and away into low wet ground,
// along a row of markers, then back to the church door. Roughly three times
// the direct road, so the church drops out of sight and arriving at the row
// feels like reaching somewhere else. It keeps the two properties the fork
// depends on: it passes through FORK and rejoins at DOOR_FRONT.
export const ROW_START = new THREE.Vector3(34, 1.7, 6);
export const ROW_END = new THREE.Vector3(30, 1.7, -22);

const workCurve = new THREE.CatmullRomCurve3(
  [
    LANDMARKS.START,
    LANDMARKS.FIELD_MID,
    FORK,
    new THREE.Vector3(9, 1.75, 21),    // turn off the church road
    new THREE.Vector3(19, 1.75, 17),   // out across the field
    new THREE.Vector3(28, 1.72, 13),   // the ground goes soft
    ROW_START,                         // the row begins
    new THREE.Vector3(35, 1.7, -6),    // along the markers
    ROW_END,                           // the row ends
    new THREE.Vector3(22, 1.65, -30),  // the road bends back
    new THREE.Vector3(8, 1.6, -26),
    new THREE.Vector3(2, 1.58, -12),
    new THREE.Vector3(1.5, 1.56, 6),   // rejoining the church road
    LANDMARKS.DOOR_FRONT, LANDMARKS.DOOR, LANDMARKS.AISLE_IN,
    LANDMARKS.AISLE_MID, LANDMARKS.ALTAR_STOP,
  ],
  false,
  'centripetal',
  0.5,
);
```

Then add, after `tNearest` is defined:

```js
// Arc-length span of the monument row, so the timeline can give that stretch
// its own deliberately slow scroll budget.
export function tRow(route = 'work') {
  return { start: tNearest(ROW_START, route), end: tNearest(ROW_END, route) };
}
```

- [ ] **Step 4: Run tests and tune the road, not the tests**

Run: `npm test`
Expected: all pass. If the length ratio falls outside 2.6–3.4, move the outbound control points further out or pull them in — never widen the assertion. If "never doubles back" fails, a control point is behind its predecessor along the road; fix the ordering.

- [ ] **Step 5: Commit**

```bash
git add src/world/path.js tests/path.test.js
git commit -m "feat: the long swamp road out to the monument row"
```

---

### Task 2: Route-aware pacing

**Files:**
- Modify: `src/choreography.js`, `src/journey.js`, `src/timeline.js`
- Test: `tests/choreography.test.js` (append), `tests/pacing.test.js` (new)

**Interfaces:**
- Consumes: `routeLength`, `tRow`, `tNearest`, `FORK`, `LANDMARKS` from `path.js`.
- Produces: `actsFor(route)` → an object of `[start, end]` spans. The direct road keeps exactly today's five acts. The work road gets six: `arrival`, `approach` (to the fork), `ride` (out to the row), `row` (the slow monument walk), `threshold` (back to and through the door), `chapel`, `beats`. `JOURNEY_VH.work` is resized. `ACTS` remains exported unchanged for the direct road.

**Why:** the work road is three times longer but the fork still sits at scroll 0.30, so inheriting the church road's spans is what crushes the monument row into a tenth of the scroll. Each stretch needs its own budget.

- [ ] **Step 1: Write the failing test**

```js
// tests/pacing.test.js
import { describe, it, expect } from 'vitest';
import { actsFor } from '../src/choreography.js';
import { JOURNEY_VH } from '../src/journey.js';
import { routeLength, tRow, tNearest, FORK } from '../src/world/path.js';
import { T_FORK_SCROLL } from '../src/world/path.js';

describe('actsFor', () => {
  for (const route of ['direct', 'work']) {
    it(`${route}: spans are contiguous from 0 to 1`, () => {
      let cursor = 0;
      for (const [start, end] of Object.values(actsFor(route))) {
        expect(start).toBeCloseTo(cursor, 5);
        expect(end).toBeGreaterThan(start);
        cursor = end;
      }
      expect(cursor).toBeCloseTo(1, 5);
    });
    it(`${route}: the fork lands at T_FORK_SCROLL so switching stays seamless`, () => {
      expect(actsFor(route).approach[1]).toBeCloseTo(T_FORK_SCROLL, 5);
    });
  }

  it('the direct road keeps its five acts unchanged', () => {
    expect(Object.keys(actsFor('direct'))).toEqual(
      ['arrival', 'approach', 'threshold', 'chapel', 'beats'],
    );
  });

  it('the work road adds the ride out and the monument row', () => {
    expect(Object.keys(actsFor('work'))).toEqual(
      ['arrival', 'approach', 'ride', 'row', 'threshold', 'chapel', 'beats'],
    );
  });
});

describe('monument row pacing', () => {
  // The bug this guards: the row previously inherited the church road's
  // fractions, so a stretch of road three times longer got the same slice of
  // scroll and the stones flew past unreadably.
  it('gives the row a slower scroll pace than the ride out to it', () => {
    const acts = actsFor('work');
    const L = routeLength('work');
    const row = tRow('work');
    const tFork = tNearest(FORK, 'work');

    const rowMetres = (row.end - row.start) * L;
    const rideMetres = (row.start - tFork) * L;
    const rowVhPerMetre = ((acts.row[1] - acts.row[0]) * JOURNEY_VH.work) / rowMetres;
    const rideVhPerMetre = ((acts.ride[1] - acts.ride[0]) * JOURNEY_VH.work) / rideMetres;

    expect(rowVhPerMetre).toBeGreaterThan(rideVhPerMetre * 1.4);
  });

  it('gives each stone enough scroll to be read', () => {
    const acts = actsFor('work');
    const rowVh = (acts.row[1] - acts.row[0]) * JOURNEY_VH.work;
    // Ten stones; each wants clearly more than a screen of scroll.
    expect(rowVh / 10).toBeGreaterThan(120);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pacing.test.js`
Expected: FAIL — `actsFor` is not exported.

- [ ] **Step 3: Write the implementation**

In `src/choreography.js`, keep `ACTS` and `createState` exactly as they are, and add:

```js
// The work road is roughly three times longer than the church road, but the
// fork still sits at the same scroll fraction on both (that is what makes
// switching roads seamless). So it cannot inherit the church road's act
// boundaries: doing that is what crushed the monument row into a tenth of
// the scroll and made the stones unreadable. Each stretch gets its own
// budget instead, with the row deliberately the slowest thing on the site.
const WORK_ACTS = {
  arrival:   [0.00, 0.15],
  approach:  [0.15, 0.30], // to the signpost — the fork, same fraction as direct
  ride:      [0.30, 0.52], // out across the field into the low ground
  row:       [0.52, 0.80], // the monument walk: slowest pace on the site
  threshold: [0.80, 0.90], // back to the church and through the door
  chapel:    [0.90, 0.96],
  beats:     [0.96, 1.00],
};

export function actsFor(route) {
  return route === 'work' ? WORK_ACTS : ACTS;
}
```

In `src/journey.js`, resize the work road and record why:

```js
export const JOURNEY_VH = { direct: 1000, work: 3000 };
```

with a comment above it:

```js
// The work road is ~3x the direct road's length, so it needs ~3x the scroll
// to hold a comparable pace. Sizing this by feel rather than by length is
// what produced the "it speeds up way too much" complaints earlier.
```

In `src/timeline.js`, replace the `ACTS` import with `actsFor` and take the spans from the route:

```js
import { actsFor } from './choreography.js';
```

and inside `buildTimeline`, replace the destructuring block with:

```js
  const acts = actsFor(route);
  const [, arrivalEnd] = acts.arrival;
  const [approachStart, approachEnd] = acts.approach;
  const [thresholdStart, thresholdEnd] = acts.threshold;
  const [chapelStart, chapelEnd] = acts.chapel;
```

Then, so the work road actually uses its extra spans, add — immediately after the existing approach tweens and only when those acts exist:

```js
  // The ride out and the monument walk exist only on the work road. The row
  // is deliberately the slowest stretch on the site: it is the one place a
  // visitor is expected to read rather than travel.
  if (acts.ride && acts.row) {
    const rowSpan = tRow('work');
    tl.to(state, { pathT: rowSpan.start, duration: acts.ride[1] - acts.ride[0], ease: 'sine.inOut' }, acts.ride[0])
      .to(state, { pathT: rowSpan.end, duration: acts.row[1] - acts.row[0], ease: 'none' }, acts.row[0]);
  }
```

Add `import { tRow } from './world/path.js';` to the existing path import.

Finally, the threshold act's pathT tween currently starts from wherever the approach left off; on the work road it must pick up from the row's end. It already tweens *to* `DOOR_IN_T`, so no change is needed there — verify this in Step 4 rather than assuming.

- [ ] **Step 4: Verify**

Run: `npm test && npm run build`
Expected: all pass. Then confirm by inspection that on the work road `pathT` progresses monotonically across the act boundaries (approach → ride → row → threshold) with no backward jump; if the threshold tween starts from a lower value than the row ended at, give it an explicit `fromTo`.

- [ ] **Step 5: Commit**

```bash
git add src/choreography.js src/journey.js src/timeline.js tests/pacing.test.js
git commit -m "feat: route-aware act spans so the monument row reads at walking pace"
```

---

### Task 3: Swamp dressing

**Files:**
- Create: `src/world/swamp.js`
- Modify: `src/scenes/sceneManager.js`
- Test: `tests/swamp.test.js`

**Interfaces:**
- Consumes: `positionAt`, `tRow` from `path.js`; `TIERS` from `device.js`.
- Produces: `SWAMP_CENTRE` / `SWAMP_RADIUS`; `swampReedSpots(count)` — deterministic positions; `buildSwamp({ scene, tier })` → `{ water }`. The scene manager builds it once.

- [ ] **Step 1: Write the failing test**

```js
// tests/swamp.test.js
import { describe, it, expect } from 'vitest';
import { SWAMP_CENTRE, SWAMP_RADIUS, swampReedSpots } from '../src/world/swamp.js';
import { positionAt, tRow } from '../src/world/path.js';

describe('the swamp', () => {
  it('sits around the monument row, not around the church', () => {
    const row = tRow('work');
    const mid = positionAt((row.start + row.end) / 2, 'work');
    expect(Math.hypot(mid.x - SWAMP_CENTRE[0], mid.z - SWAMP_CENTRE[1])).toBeLessThan(SWAMP_RADIUS);
    // The church door must be well outside it — the swamp is somewhere else.
    expect(Math.hypot(0 - SWAMP_CENTRE[0], 0 - SWAMP_CENTRE[1])).toBeGreaterThan(SWAMP_RADIUS);
  });

  it('places reeds deterministically', () => {
    expect(swampReedSpots(40)).toEqual(swampReedSpots(40));
  });

  it('keeps reeds out of the camera corridor', () => {
    for (const [x, z] of swampReedSpots(120)) {
      let min = Infinity;
      for (let i = 0; i <= 200; i++) {
        const p = positionAt(i / 200, 'work');
        min = Math.min(min, Math.hypot(p.x - x, p.z - z));
      }
      expect(min).toBeGreaterThan(0.8);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/swamp.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```js
// src/world/swamp.js
import * as THREE from 'three';
import { positionAt, tRow } from './path.js';

// Low wet ground around the monument row. Deliberately far from the church
// so the two places read as different countries.
export const SWAMP_CENTRE = [32, -8];
export const SWAMP_RADIUS = 34;

// Same seeded generator style as the grass field: deterministic placement is
// what lets the corridor-clearance test above mean anything.
function makeLcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function swampReedSpots(count) {
  const rand = makeLcg(20260811);
  const spots = [];
  let guard = 0;
  while (spots.length < count && guard < count * 40) {
    guard += 1;
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * SWAMP_RADIUS;
    const x = SWAMP_CENTRE[0] + Math.cos(a) * r;
    const z = SWAMP_CENTRE[1] + Math.sin(a) * r;
    let min = Infinity;
    for (let i = 0; i <= 100; i++) {
      const p = positionAt(i / 100, 'work');
      min = Math.min(min, Math.hypot(p.x - x, p.z - z));
    }
    if (min > 1.1) spots.push([+x.toFixed(2), +z.toFixed(2)]);
  }
  return spots;
}

export function buildSwamp({ scene, tier }) {
  // Still black water, just below the ground plane so the shoreline is the
  // ground's own edge rather than a modelled bank.
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(SWAMP_RADIUS, 48),
    new THREE.MeshStandardMaterial({
      color: '#080c0b', roughness: 0.15, metalness: 0.6,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(SWAMP_CENTRE[0], -0.06, SWAMP_CENTRE[1]);
  scene.add(water);

  // Reeds: two crossed blades per tuft, instanced, same trick as the grass.
  const count = tier === 'low' ? 120 : 320;
  const blade = new THREE.PlaneGeometry(0.09, 1.5);
  blade.translate(0, 0.75, 0);
  const second = blade.clone();
  second.rotateY(Math.PI / 2);
  const tuft = THREE.BufferGeometryUtils
    ? blade
    : blade; // merged below if available; a single blade still reads at distance
  const reeds = new THREE.InstancedMesh(
    tuft,
    new THREE.MeshStandardMaterial({
      color: '#2f3524', roughness: 1, side: THREE.DoubleSide, transparent: true, alphaTest: 0.4,
    }),
    count,
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  swampReedSpots(count).forEach(([x, z], i) => {
    p.set(x, -0.04, z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i * 2.399) % (Math.PI * 2));
    s.set(1, 0.7 + ((i * 37) % 60) / 100, 1);
    reeds.setMatrixAt(i, m.compose(p, q, s));
  });
  reeds.instanceMatrix.needsUpdate = true;
  scene.add(reeds);

  return { water };
}
```

Note the `tuft` line above is intentionally a single blade: merging the crossed blades needs `BufferGeometryUtils`, which is an addon import. If you want the crossed look, import `mergeGeometries` from `three/addons/utils/BufferGeometryUtils.js` and merge `blade` and `second`; otherwise leave the single blade, which reads acceptably at the distances involved. Choose one and delete the dead branch — do not leave the ternary in place.

In `src/scenes/sceneManager.js`, add `import { buildSwamp } from '../world/swamp.js';` and call `buildSwamp({ scene, tier });` immediately after the existing `buildWorld(...)` call.

- [ ] **Step 4: Verify**

Run: `npm test && npm run build`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/world/swamp.js tests/swamp.test.js src/scenes/sceneManager.js
git commit -m "feat: swamp water and reeds around the monument row"
```

---

### Task 4: Song titles carved into the stones

**Files:**
- Modify: `src/world/monuments.js`, `src/main.js`
- Test: `tests/monuments.test.js` (append)

**Interfaces:**
- Consumes: `makeEngravedTexture`, `ENGRAVED_INK`, `ENGRAVED_LIT` from `engraving.js`; `CREDITS` from `content/portfolio.js`; `tRow`, `positionAt` from `path.js`; the picker from `picking.js`.
- Produces: monument spots recomputed along the new road; each stone carries `userData.href` (the credit's URL) and `userData.textMesh`; `buildMonuments` returns `creditStones` (the clickable meshes). `main.js` picks them the same way it picks sign arms.

- [ ] **Step 1: Write the failing test**

Append to `tests/monuments.test.js`:

```js
describe('song stones on the new road', () => {
  it('lines the monument row rather than the old loop', () => {
    const row = tRow('work');
    for (const [x, z] of MONUMENT_SPOTS) {
      let bestT = 0;
      let best = Infinity;
      for (let i = 0; i <= 400; i++) {
        const t = i / 400;
        const p = positionAt(t, 'work');
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < best) { best = d; bestT = t; }
      }
      // Every stone's nearest point on the road falls inside the row span.
      expect(bestT).toBeGreaterThanOrEqual(row.start - 0.03);
      expect(bestT).toBeLessThanOrEqual(row.end + 0.03);
    }
  });
  it('still clears the camera corridor', () => {
    expect(minWorkPathClearance()).toBeGreaterThan(1.4);
  });
  it('still flanks both sides of the road', () => {
    const sides = MONUMENT_SPOTS.map(([x, z]) => sideOfRoute(x, z));
    expect(sides.some((s) => s > 0)).toBe(true);
    expect(sides.some((s) => s < 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/monuments.test.js`
Expected: FAIL — the old spots sit nowhere near the new row.

- [ ] **Step 3: Recompute the spots against the new road**

Write a throwaway script (in the scratchpad, not the repo) that samples the work curve between `tRow('work').start` and `.end`, steps a perpendicular offset of about 2.8–3.4m alternately to each side for ten stones, and prints the tuples plus the measured `minWorkPathClearance()` and `minDirectPathDistance()`. Paste the printed values into `MONUMENT_SPOTS`, and record the measured clearances in the comment above it — the same pattern the existing comment uses. Do not hand-adjust the numbers afterwards.

- [ ] **Step 4: Carve the titles and make the stones clickable**

In `src/world/monuments.js`, import the engraving helpers and `CREDITS`, and in `buildMonuments`, after each stone is positioned, add a carved title plane and tag the stone:

```js
    // The song title is cut into the face of the stone, using the same
    // technique as the signpost: the canvas carries letterform alpha only,
    // the material colour is the ink, so hover can light it without redraw.
    const credit = CREDITS[i];
    if (credit) {
      const tex = makeEngravedTexture(credit.track, { widthPx: 512, heightPx: 128, basePx: 58 });
      const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(0.62, 0.16),
        new THREE.MeshBasicMaterial({
          map: tex, transparent: true, color: ENGRAVED_INK, depthWrite: false,
        }),
      );
      plate.position.set(0, STONE_HEIGHT * s * 0.62, 0.09);
      stone.add(plate);
      stone.userData.href = credit.url;
      stone.userData.textMesh = plate;
      creditStones.push(stone);
    }
```

Declare `const creditStones = [];` alongside `credits`, and return it: `return { anchors: {...}, signArms: sign.arms, creditStones };`.

- [ ] **Step 5: Wire the clicks**

In `src/main.js`, extend the sign interaction so the picker also targets the stones. The picker already walks up from a hit to the nearest ancestor with a matching `userData` key — extend `pick` usage rather than duplicating it: set the picker's targets to `[...app.signArms, ...app.creditStones]`, and in the click handler, after the existing route check, add:

```js
    // A stone opens its track. Same picker, same hover lighting -- one
    // interaction vocabulary in the world rather than two.
    if (hit?.userData?.href) window.open(hit.userData.href, '_blank', 'noopener');
```

Hover lighting already keys off `userData.textMesh`, which the stones now have, so it works unchanged — verify rather than assume.

Then **remove the floating credit labels**: delete the `attachCreditLabels` credit loop's per-stone label creation (keep the crypt label for now — Stage 3 replaces it), so the credits exist in the world as carving and in the DOM only as the static portfolio section.

- [ ] **Step 6: Verify**

Run: `npm test && npm run build`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/world/monuments.js src/main.js tests/monuments.test.js
git commit -m "feat: song titles carved into the stones, stones clickable"
```

---

### Task 5: A dirt path on both roads

**Files:**
- Modify: `src/world/world.js`
- Test: `tests/world.test.js` (append)

**Interfaces:**
- Consumes: `positionAt`, `tNearest`, `LANDMARKS` from `path.js`.
- Produces: `buildRoad(scene, route)` — the ribbon follows whichever road is named. Called once per route so both are dressed.

- [ ] **Step 1: Write the failing test**

Append to `tests/world.test.js`:

```js
import { roadSampleCount, roadEndT } from '../src/world/world.js';

describe('dirt roads', () => {
  it('stops short of the doorway on both roads, so the ribbon never enters the church', () => {
    for (const route of ['direct', 'work']) {
      const endT = roadEndT(route);
      expect(endT).toBeGreaterThan(0.1);
      expect(endT).toBeLessThan(1);
      expect(positionAt(endT, route).z).toBeGreaterThan(0);
    }
  });
  it('samples the longer road more finely so it does not go polygonal', () => {
    expect(roadSampleCount('work')).toBeGreaterThan(roadSampleCount('direct'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/world.test.js`
Expected: FAIL — neither helper is exported.

- [ ] **Step 3: Write the implementation**

In `src/world/world.js`, generalise `buildRoad`. Export the two helpers so the test can reach them, and take the route as a parameter:

```js
// The ribbon stops just shy of the doorway: running it through the door
// would put dirt down the aisle.
export function roadEndT(route) {
  return Math.min(tNearest(LANDMARKS.DOOR, route) - 0.015, 0.98);
}

// A road three times longer needs proportionally more segments, or the
// curve visibly facets.
export function roadSampleCount(route) {
  return route === 'work' ? 240 : 90;
}
```

Then change `buildRoad(scene)` to `buildRoad(scene, route = 'direct')`, replace its `steps` with `roadSampleCount(route)`, its `endT` with `roadEndT(route)`, every `positionAt(t)` with `positionAt(t, route)` (including the look-ahead sample), and name the mesh `` `roadRibbon-${route}` ``.

At the existing call site, build both:

```js
  buildRoad(scene, 'direct');
  buildRoad(scene, 'work');
```

- [ ] **Step 4: Verify**

Run: `npm test && npm run build`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/world/world.js tests/world.test.js
git commit -m "feat: dirt path on both roads"
```

---

### Task 6: Walk it and fix what the screenshots show

**Files:**
- Modify: whatever the screenshots prove wrong (expected: pacing constants, swamp density, engraving size on the stones)

**Interfaces:**
- Consumes: everything above.
- Produces: a walkable swamp road.

- [ ] **Step 1: Drive the whole work road**

Start the dev server (`curl -sf http://localhost:5173 || (npm run dev >/dev/null 2>&1 &)`, then poll). Copy `verify_candles.mjs` in the scratchpad as a template — it already clicks a `#sign-controls` button to choose a road. Make it choose `work`, then screenshot at scroll 0.30, 0.38, 0.46, 0.54, 0.60, 0.66, 0.72, 0.78, 0.85, 0.92, 1.00. READ every screenshot.

Check, and report on, each of these:
1. At 0.30 the camera is at the signpost, both carved arms legible.
2. Between 0.32 and 0.50 the road visibly leaves the graveyard; **the church is out of frame** for at least part of the ride.
3. The swamp reads as water and reeds, distinct from the graveyard's grass.
4. Through the row (roughly 0.52–0.80) the stones pass slowly enough to read, with the **carved song titles legible**, and roughly one stone at a time dominating the frame.
5. The road returns and the church comes back into view before the door.
6. The church sequence — door, aisle, candles igniting ahead of the camera, altar, beats embed — still works on this road.
7. No floating HTML credit labels anywhere.

- [ ] **Step 2: Fix what is wrong, then re-drive**

Likely adjustments, in order of likelihood: the `row` span's share of scroll (in `WORK_ACTS`) if the stones still pass too fast or now crawl; `basePx` on the stones' engraved texture, or the plate's size and height on the stone, if titles are unreadable; reed `count` and `SWAMP_RADIUS` if the swamp is sparse or overwhelming; the road's control points if the church stays visible the whole way.

Change constants, re-run the driver, Read the screenshots again. Repeat until every numbered item above holds. Stop at "the screenshots show it", not at "the numbers changed".

- [ ] **Step 3: Full verification**

Run: `npm test && npm run build`
Then confirm the direct road is untouched: drive it end to end and check the church journey is identical to before.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: calibrate the swamp road from screenshots"
```
