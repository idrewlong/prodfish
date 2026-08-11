# The Swamp Road — Design (Second Act, Stage 2)

**Date:** 2026-08-11
**Status:** Approved
**Builds on:** `2026-08-11-choice-moment-design.md` (the carved signpost and the parked choice, shipped)

## Problem

Choosing "the work" currently turns onto a short loop that rejoins the church
almost immediately. Three things are wrong with it:

1. It does not feel like going somewhere. The user asked for a road that
   "veers off right, much further back… almost like a new scene."
2. The credits float over the stones as HTML labels rather than being part of
   the world — the same complaint that led to carving the signpost.
3. The monument row is crushed into roughly 10–15% of the scroll, so the
   stones fly past faster than anyone can read them. This was found during
   the fork wiring and deliberately deferred to this stage.

The direct road also has a dirt path while the work road has none.

## Decisions

- The work road runs **roughly three times the length of the direct road**, so
  the church drops out of sight and arriving somewhere else is an event.
- **Song titles are carved into the gravestones, and the stone itself is
  clickable** — the same mechanic as the signpost, so there is one interaction
  vocabulary in the world rather than two.
- **Both roads get a dirt path.**
- The pacing is rebuilt so the monument row reads at a walking pace.

## The road

`positionAt`'s `work` curve is replaced with a longer route that leaves the
fork heading right, runs out and back through low ground, and returns to the
church door. It keeps the two properties the fork depends on: it passes
through `FORK`, and it rejoins at `DOOR_FRONT`, so the church sequence is
untouched and switching roads at the fork stays seamless.

Because the road triples in length, `JOURNEY_VH.work` grows with it. The
existing parking machinery already derives everything from `JOURNEY_VH`, so no
new scroll mechanism is needed — only the number changes.

## Pacing

The current work route inherits the direct road's act boundaries, which is why
the monument row is crushed: the same fixed fractions have to cover a much
longer road. The acts therefore become **route-aware**. On the work road the
approach act stretches to cover the ride out, and a new **row** span covers the
monument walk at a deliberately slow, near-constant pace; the threshold,
chapel and beats acts keep their existing meaning and relative feel.

Metres-per-scroll through the monument row is the acceptance criterion, not a
fraction: each stone should occupy enough scroll to be read without stopping.

## The swamp

The work road's ground is dressed as low, wet country rather than a second
graveyard-on-grass: a still water plane at just below ground level with a dark,
barely-moving surface; reeds and cypress-style trunks reusing the existing
instanced-grass and tree machinery with different parameters and colours;
thicker, lower-lying fog than the approach; and the moon lower and dimmer here
so the place reads as further from the church. This is a re-dress of existing
systems, not new rendering.

## The song stones

Ten monument stones line the road, each carrying a credit. The song title is
engraved using the same texture-and-material technique as the signpost, so:

- the title reads as cut into the stone, at a size legible while moving;
- the whole stone is a click target, resolved by the existing raycast picker,
  which already walks up from a hit to the nearest ancestor carrying a route
  or link;
- hovering lights the carving and switches the cursor.

Clicking opens that credit's URL in a new tab. The stones' geometry, spacing
and clearance are recomputed against the new road with the existing measured
approach — sampling the curve and stepping a perpendicular offset — never
hand-placed.

The floating HTML credit labels are removed. The static portfolio section
(built for reduced-motion and no-WebGL visitors) becomes the accessible and
crawlable copy of the same data, so the credits remain in the DOM as real
links for keyboard users, screen readers and search engines even though the
in-world presentation is carved stone.

## What is deliberately deferred to Stage 3

The rider's building, the character, the motorcycle, the about wall and its
social links, and the exit routing from that building back to the church. The
road built here ends by rejoining the church door; Stage 3 inserts the
building along it.

## Testing

Pure and unit-testable: the new road's continuity at `FORK` and `DOOR_FRONT`;
its length ratio; monotonic forward travel; stone clearance from the road and
distance from the direct road; the per-route act spans summing to 1 and
staying ordered; and the metres-per-scroll through the monument row falling
inside a readable band.

The swamp dressing, engraving legibility, and the feel of the ride are
verified visually with the headless-browser screenshot driver, including a
pass that confirms the church is genuinely out of sight mid-journey.
