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
  const t = clamp01(doorT);
  return t === 0 ? 0 : -t * 1.92;
}
