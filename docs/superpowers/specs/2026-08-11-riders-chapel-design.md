# The Rider's Chapel — Design (Second Act, Stage 3)

**Date:** 2026-08-11
**Status:** Approved
**Builds on:** `2026-08-11-swamp-route-design.md` (the swamp road, shipped)

## Problem

The scenic road now runs out through swamp country past ten carved song
stones and back to the church. It needs its destination: a building the
visitor rides into, carrying the bio and social links, with a rider figure
and his motorcycle outside — after which the road carries on to the church
and the beats, as it does today.

## Decisions

- **A rider of our own, not Marvel's.** Ghost Rider is Marvel's character and
  a recognisable replica on a commercial site is a genuine legal risk. The
  figure is a hooded, skeletal rider wreathed in flame — the same feeling,
  our own design, generated to match the site's art direction. Nothing in the
  model, its textures, or any copy on the site refers to the film or the
  character by name.
- **The visitor scrolls straight through the building**, exactly as they do
  the church: ride up, the door opens, drift down the middle to the far wall,
  out the other side. One interaction vocabulary, and it reuses machinery
  that already works.
- **Exiting carries on to the church**, so every visitor reaches the beats
  whichever road they took.

## Where it sits

The building stands at the far end of the monument row, where the road turns
for home — so the row reads as an approach to it rather than a detour from
it. The road is re-shaped so it passes **through** the building: in at the
near door, out at the far one, rejoining the return leg. That keeps the
existing "one continuous road" property rather than introducing a second
kind of movement.

Its placement is measured against the road, like everything else on this
site: the doorway straddles the road's centre line at the point chosen, and
the building is scaled so its opening clears the eye-height camera — the same
failure the church hit when it was scaled by overall height instead of by its
door.

## Inside

A single room, long enough to drift through. The far wall carries:

- the **bio**, engraved into the plaster in the same technique as the song
  stones and the signpost;
- the **social links**, each carved and individually clickable through the
  existing raycast picker;
- the **catalog link**.

Lighting is a warm, low fire-glow rather than the church's red neon, so the
two interiors read as different places. The rider stands or sits to one side
— not blocking the road — lit by that glow.

The motorcycle stands outside the near door, angled across the trail, close
enough to read as recently ridden.

## Assets

- **Rider** and **motorcycle** generated as GLBs through Higgsfield's
  image-to-3D, prompted from this site's own art direction, then run through
  the existing `assets:build` pipeline with a triangle budget like the other
  props. Both are optional at load: if either fails, the scene builds without
  it rather than blocking, exactly as every other model does.
- The **building** is built from primitives, like the signpost and crypt.
  Modelled architecture is not needed for a dark interior lit by one fire,
  and primitives are the one asset source that cannot fail to load.

## Pacing

The work road's act table gains a **chapel-of-the-work** span between the row
and the return, budgeted like the row: slow enough to read a wall of text
while moving. `JOURNEY_VH.work` grows to match, so metres-per-scroll stays
consistent with the rest of the road.

## Accessibility and fallbacks

The bio and social links are carved in-world, so — exactly as with the song
stones — the DOM copy lives in the static portfolio section that
reduced-motion and no-WebGL visitors already get. Keyboard users reach the
links there. No credit, link, or line of the bio exists only as geometry.

## Testing

Pure and unit-testable: the road still passes through `FORK` and rejoins at
`DOOR_FRONT`; the building's doorways straddle the road; the rider and
motorcycle clear the camera corridor; the act spans stay contiguous and
ordered with the new span; metres-per-scroll through the interior falls in a
readable band.

The interior's light, the legibility of the engraved bio, and whether the
rider reads as intended are verified from screenshots.

## Out of scope

Apparition flashes between the trees, the intro audio gate, and any change to
the church sequence.
