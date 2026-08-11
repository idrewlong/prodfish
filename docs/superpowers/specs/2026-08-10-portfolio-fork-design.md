# Portfolio Fork — Design

**Date:** 2026-08-10
**Status:** Awaiting approval
**Builds on:** `2026-08-09-seamless-3d-world-design.md` (the seamless 3D world, now shipped)

## Problem

The site is one linear walk to the church altar. It needs a portfolio (production
credits) and a short bio, without diluting the beats — which are the point of the
site.

## Decision

**Two routes, one destination.** A weathered signpost stands at a fork in the
graveyard. Keep scrolling and you take the direct path to the church. Click the
signpost's "THE WORK" arm and the camera takes the scenic route — past a row of
monument stones (one per credit) and a crypt bearing the bio — then rejoins the
direct path at the church door. Both routes end at the altar and the beats.

Nobody misses the beats. The choice is real. Both curves share their start and
end points, so the swap is geometrically seamless.

## Route geometry

`src/world/path.js` gains a second curve. The existing curve is **unchanged**
(so its tests and the shipped choreography keep passing) and becomes the
`direct` route. The new `work` route shares `START…FORK` and `DOOR_FRONT…
ALTAR_STOP` with it, diverging only in between:

```
FORK        — signpost; NOT hardcoded, but sampled from the existing
              curve at T_FORK ≈ 0.28 (lands around z ≈ 22)
  → ROW_IN    (6.5, 1.7, 18)
  → ROW_MID   (11, 1.7, 12)   — monument row, stones flanking both sides
  → CRYPT     (13.5, 1.7, 6)  — bio, full-catalog link
  → RETURN    (7, 1.6, 2.5)
  → DOOR_FRONT (0, 1.55, 3.2) — rejoins the direct route
```

`FORK` must be read from the direct curve rather than written by hand, or the
two routes will not actually meet. For the same reason, the work curve is
built including the direct curve's *neighbouring* control points on either
side of the junction, so the two share a tangent direction and the swap
produces no visible kink.

The work route is roughly 1.6× the direct route's length between those points.

Public API becomes `positionAt(t, route = 'direct')` and
`targetAt(t, route = 'direct')`; existing callers and tests are unaffected by
the default. `T_FORK` joins the exported landmark constants.

## Choosing a route

- The signpost is a low-poly wooden post with two arms, built from primitives
  (reliable, no asset hunt), standing at `FORK` beside the path.
- Its arms are labelled by **projected DOM elements**, not 3D text: each frame,
  the anchor's world position is projected to screen space and a real
  `<a>`/`<button>` is positioned there. This keeps the labels crisp at any
  distance, keyboard-focusable, screen-reader legible, and genuinely clickable.
- Clicking "THE WORK" sets the route to `work`; "THE BEATS" (or simply
  continuing to scroll) keeps `direct`.
- The route is switchable only while the camera is at or before the fork.
  Past it, the choice is locked; scrolling back before the fork unlocks it.
  Because both curves coincide at `FORK`, switching there causes no jump.

## Scroll length

The work route covers more ground, so it needs more scroll to keep the
metres-per-scroll pacing the user just approved. `#scroll-track` grows from
1000vh to 1600vh when the work route is selected, followed by
`ScrollTrigger.refresh()`. The added length falls *below* the viewer's current
position (they are at the fork when they choose), so their scroll position stays
valid and nothing jumps.

## The monument row

- Ten stones, sourced from the ten meshes inside `public/models/grave_stones.glb`
  (7.5k triangles total; routed through the existing Draco pipeline first). Each
  distinct mesh becomes one credit marker, alternating sides of the route.
- As the camera passes each stone, a projected DOM label fades in: artist —
  track, wrapping a real link. Fade is driven by the scroll timeline, so it
  scrubs both ways.
- The crypt at the row's end is the existing chapel-adjacent geometry vocabulary
  (a stone box with a doorway); the bio panel and full-catalog link fade in as a
  DOM overlay when the camera settles there, styled like the existing chapel
  section.

## Content

All copy lives in one module, `src/content/portfolio.js`, exporting
`CREDITS` (array of `{ artist, track, url }`) and `BIO` (string) — a single
place to swap placeholders for real data. Ships with clearly-marked filler:
ten plausible credits and a three-sentence bio, so the experience is complete
and reviewable now.

## Fallbacks and accessibility

- Because the labels, bio, and links are already DOM, the reduced-motion and
  no-WebGL paths render the same content as a plain static section — no
  duplicate copy, no separate data.
- Every label is a real focusable link with visible focus styling; the signpost
  arms are reachable by keyboard, so the branch is not mouse-only.
- Labels are hidden (`aria-hidden`, `pointer-events: none`) while their anchor
  is behind the camera or occluded by fog distance.

## Performance

Ten monument stones plus the signpost add roughly 8k triangles, well inside the
budget the low-tier thinning already manages. Projected labels are DOM writes on
already-running frames — a handful of `style.transform` updates per frame, no
new render passes. Low tier caps simultaneously-visible labels.

## Testing

- Pure, unit-testable: route curve continuity (both routes agree in *position*
  at `FORK` and `DOOR_FRONT` within tolerance, and in *tangent direction* at
  those junctions so the swap cannot kink), monotonic forward travel on the
  work route,
  the work route's corridor clearance against its monument spots, label
  visibility windows, and the route lock/unlock rule around the fork.
- Rendering and pacing verified visually with the existing headless-Chrome
  screenshot driver, on both routes.

## Out of scope

Deferred to their own designs: apparition flashes between the trees, fire
elements, and the click-to-enter audio gate.
