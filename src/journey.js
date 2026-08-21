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

// The chapel is `position: absolute; bottom: 0` inside the track, so it always
// occupies the track's LAST pixels and grows upward. At one viewport tall its
// top edge lands at 15V -- exactly where the master timeline ends. Left alone,
// a three-station chapel would put that edge at 13V and start framing itself
// while the camera was still walking, which is the "position shifts" jump the
// ACT 5 opacity ramp exists to prevent (see style.css on #chapel).
//
// So the track absorbs the overflow. The chapel occupies the bottom V + E of a
// 16V + E track, which puts its top edge back at 15V, unmoved. The timeline
// still spans journeyDistancePx(V) and still ends where it did; the extra E is
// pure post-journey scroll that reveals the second and third stations.
//
// Safe to measure: #chapel is absolutely positioned and full-width, so its
// height follows from its content and the viewport width, never from the track
// height this returns. No circularity.
export function trackPxWithChapel(viewportPx, chapelPx) {
  const overflow = Number.isFinite(chapelPx) ? Math.max(0, chapelPx - viewportPx) : 0;
  return journeyTrackPx(viewportPx) + overflow;
}
