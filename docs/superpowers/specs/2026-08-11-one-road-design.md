# One Road — Design

**Date:** 2026-08-11
**Status:** Approved
**Supersedes:** the fork and everything downstream of it —
`2026-08-10-portfolio-fork-design.md`, `2026-08-11-choice-moment-design.md`,
`2026-08-11-swamp-route-design.md`, `2026-08-11-riders-chapel-design.md`.

## Problem

The site grew a second road, and it made the experience worse. Measured:

- **44 seconds of brisk scrolling — nearly two minutes at a casual pace —
  before a single beat appears** on the scenic road. Even the short road is
  8–21 seconds *plus* a mandatory click.
- **A hard gate mid-journey.** The page cannot scroll past the signpost until
  the visitor clicks a carved sign arm. Anyone who does not realise it is
  clickable is stuck with no way forward.
- **The credits are buried deepest** — 17–29 seconds in, on the road most
  visitors will not take — even though they are the thing that earns trust.
- **Work-route logic reaches into 8 of the ~12 source files.** Most bugs in
  this build were coupling failures between the two roads.

The thing the site exists to sell is the last thing anyone reaches.

## Decisions

- **One road.** The fork, the signpost, the scroll gate, the scenic route and
  the rider's chapel are all removed.
- **The swamp comes to the road.** Its water, reeds and dead trees are
  relocated along the church approach, so the single journey reads as
  low-country southern gothic — marshy Louisiana/Alabama — rather than the
  dry graveyard it is today. This is why the swamp work is being moved, not
  deleted.
- **The beats are the destination, and the hub.** Arriving at the altar, the
  visitor gets the beats immediately. Left/right arrows then slide
  horizontally between three panels — **beats**, **the work**, **about** —
  with no further scrolling and nothing moving in 3D.
- **The carved song stones stay**, relocated along the approach. A few
  production credits glimpsed as atmosphere on the way in; the full list
  lives in the panel at the end.

## The journey

`START → the marsh → the church door → the aisle → the altar`, roughly
15–20 seconds of scrolling. Unchanged in structure from the road that
already works; only its dressing and its length change.

Because there is only one road, a great deal disappears with it: route
selection, route-aware act tables, route-aware landmark parameters,
per-route journey heights, the parking mechanism that shortened the
document, and the timeline rebuild on switching. The camera path, the
church sequence, the candle timing and the engraving technique are all
untouched.

## The marsh

The existing swamp dressing moves to sit along the church approach: still
water either side of the trail, tall reeds standing in it, dead trees
overhead, held clear of the camera corridor by the same measured clearance
rules used today. The graveyard's own grass and gravestones remain; the
marsh is layered into them rather than replacing them.

The motorcycle is kept as a single roadside prop — abandoned by the trail,
which reads as southern gothic and costs nothing now the asset exists. The
rider figure is retired with the chapel; a character standing in the field
adds a question the site does not need to answer.

## The panels

At the beats, a horizontal strip of three panels with arrow controls:

1. **beats** — the BeatStars embed, shown first and by default.
2. **the work** — the full production credit list, each a real link.
3. **about** — the bio, the social links, the contact line.

Built as real HTML: arrows and swipe move a transform, nothing is
recreated. That means keyboard users, screen readers and search engines get
the whole catalog and bio for free, which the carved-in-world version never
could — and it removes the need for a separate hidden fallback section,
since this content is now genuinely part of the page.

The panel strip inherits the existing chapel section's styling so it still
reads as the altar rather than as a web widget.

## What is removed

`src/world/route.js`, `src/world/chapelOfWork.js`, the `work` curve and row
markers in `path.js`, `WORK_ACTS`/`actsFor`, per-route journey sizing, the
signpost and its accessible controls, the choice prompt, and the picking and
label machinery that existed only to serve them — retained only where the
song stones still need it.

Their tests go with them. Tests covering the camera path, the church
sequence, candle timing, device tiers and prop clearance all stay.

## Testing

The suite shrinks with the surface. What remains must still prove: the
camera path is continuous and forward-travelling; props and marsh dressing
clear the camera corridor; candles ignite with real lead before the camera
reaches them; act spans are contiguous; and the panel strip exposes every
credit, the bio and the socials as real links.

Pacing and the marsh's look are verified from screenshots, as before.

## Out of scope

Apparition flashes, fire elements beyond the existing candles, the intro
audio gate, and any change to the church interior.
