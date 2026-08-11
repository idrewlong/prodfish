import { T_FORK_SCROLL } from './world/path.js';

// How much scroll each road is worth. The scenic route covers more ground,
// so it needs more scroll to hold the same unhurried pace.
// The work road is ~2.9x the direct road's length AND has to give the monument row a
// deliberately slow stretch, so it needs proportionally more
// scroll to hold a comparable pace. Sizing this by feel rather than by the
// road's measured length is what produced the earlier "it speeds up way too
// much" complaints.
export const JOURNEY_VH = { direct: 1000, work: 4500 };

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
