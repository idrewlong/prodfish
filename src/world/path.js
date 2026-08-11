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
const T_FORK_DIRECT = 0.389;
export const FORK = directCurve.getPointAt(T_FORK_DIRECT);

// The scenic road: out of the graveyard, right and away into low wet ground,
// wandering wide of the church before it ever gives up its forward progress,
// along a row of markers, then back to the church door. Roughly three times
// the direct road, so the church drops out of sight and arriving at the row
// feels like reaching somewhere else. It keeps the two properties the fork
// depends on: it passes through FORK and rejoins at DOOR_FRONT.
//
// Note: z decreases monotonically along this route, same as the direct
// road — every work-only control point stays north of DOOR_FRONT's z. A
// horseshoe that dipped south past the church and swung back would read as
// the camera reversing mid-scroll (the existing "z never doubles back"
// test catches exactly that), so the extra distance is built laterally —
// wide swings in x — rather than by looping past the building.
// The row runs high (z 21 -> 16) while the return leg hugs z 8 and below.
// That separation is deliberate and load-bearing: the stones stand a few
// metres off the row on BOTH sides, and an earlier layout that let the two
// legs converge pushed the inner stones onto the return road, leaving 0.6m
// of clearance where 1.4m is required.
export const ROW_START = new THREE.Vector3(22, 1.75, 21);
export const ROW_END = new THREE.Vector3(62, 1.68, 16);

const workCurve = new THREE.CatmullRomCurve3(
  [
    LANDMARKS.START,
    LANDMARKS.FIELD_MID,
    FORK,
    new THREE.Vector3(10, 1.78, 23),   // turn off the church road
    ROW_START,                         // the row begins
    new THREE.Vector3(36, 1.73, 19),   // out along the markers
    new THREE.Vector3(50, 1.70, 17.5), // deeper into the low ground
    ROW_END,                           // the row ends
    new THREE.Vector3(54, 1.62, 8),    // the road bends back
    new THREE.Vector3(36, 1.59, 5.6),
    new THREE.Vector3(16, 1.57, 4.2),  // rejoining the church road
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
// Resolution note: 400 samples left a ~0.057m gap near the FORK parameter
// (t ~= 0.389, where the curve's arc-length lookup table has more
// approximation error), just over the 0.05m tolerance used in tests. 800
// samples brings that to ~0.014m without changing any curve geometry.
export function tNearest(point, route = 'direct') {
  const c = curveFor(route);
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i <= 800; i++) {
    const t = i / 800;
    const d = c.getPointAt(t).distanceToSquared(point);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

// Arc-length span of the monument row, so the timeline can give that stretch
// its own deliberately slow scroll budget.
export function tRow(route = 'work') {
  return { start: tNearest(ROW_START, route), end: tNearest(ROW_END, route) };
}

export const T_GATE = tNearest(LANDMARKS.GATE);
export const T_DOOR = tNearest(LANDMARKS.DOOR);
export const T_ALTAR = tNearest(LANDMARKS.ALTAR_STOP);
