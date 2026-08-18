// How much scroll the journey is worth. One road, one number.
export const JOURNEY_VH = 1600;

const VIEWPORT_VH = 100;

// The scroll distance the master timeline spans, in pixels. Derived from the
// journey rather than from the document's current height so the timeline
// cannot be squeezed or stretched by unrelated layout changes.
export function journeyDistancePx(viewportPx) {
  return (JOURNEY_VH / VIEWPORT_VH - 1) * viewportPx;
}

// The full height the scroll track must be given, in pixels, so that the
// document runs out at exactly the moment the timeline does.
//
// This MUST be set in pixels off the same basis the timeline spans, not in
// `vh`. On iOS Safari `vh` resolves against the LARGE viewport (toolbar
// retracted) while `window.innerHeight` reports the SMALL one (toolbar shown)
// -- so a `1600vh` track paired with a `15 * innerHeight` timeline left ~2
// extra screens of dead scrolling after the journey had already finished,
// with the beats panel stranded down in it. On desktop the two units are
// equal, which is why this only ever went wrong on a phone.
export function journeyTrackPx(viewportPx) {
  return (JOURNEY_VH / VIEWPORT_VH) * viewportPx;
}

// The viewport height the whole journey is measured against, sampled once and
// then held.
//
// iOS Safari grows and shrinks `window.innerHeight` by 60-110px as its
// toolbar collapses and expands DURING the scroll. Re-deriving the journey
// from that moving number means the scroll-to-camera mapping shifts
// underneath the visitor mid-walk -- the lurch. Freezing the basis at boot
// keeps one stable mapping for the whole journey. A genuine layout change
// (device rotation) calls resetViewportBasis() and re-measures; a toolbar
// wobble does not.
let frozen = null;

export function viewportBasis(innerHeight) {
  if (frozen === null) frozen = innerHeight;
  return frozen;
}

export function resetViewportBasis() {
  frozen = null;
}
