// How much scroll the journey is worth. One road, one number.
export const JOURNEY_VH = 1600;

const VIEWPORT_VH = 100;

// The scroll distance the master timeline spans, in pixels. Derived from the
// journey rather than from the document's current height so the timeline
// cannot be squeezed or stretched by unrelated layout changes.
export function journeyDistancePx(innerHeight) {
  return (JOURNEY_VH / VIEWPORT_VH - 1) * innerHeight;
}
