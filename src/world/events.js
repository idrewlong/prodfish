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

// Door swings OUTWARD, toward the camera/exterior, hinged on the LEFT jamb
// (see world.js). Negative Y rotation is the one that carries the leaf out
// through the portal from that pivot.
//
// Capped at 90 degrees (MAX_ANGLE), not the full ~100-110 a swinging door
// would travel in open air: past flush-against-the-wall, the leaf's outer
// edge swings back into the flanking pilaster that sits right at the jamb
// line, in this stepped 1.6m-deep Gothic reveal. Stopping at flush is both
// the point it stays clear of that stonework and the natural resting pose
// for a door swung all the way open.
const MAX_ANGLE = Math.PI / 2;

export function doorAngle(doorT) {
  const t = clamp01(doorT);
  return t === 0 ? 0 : -t * MAX_ANGLE;
}
