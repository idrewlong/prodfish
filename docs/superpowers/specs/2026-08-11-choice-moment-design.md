# The Choice Moment — Design (Second Act, Stage 1)

**Date:** 2026-08-11
**Status:** Approved
**Builds on:** `2026-08-10-portfolio-fork-design.md` (the fork, shipped)

## Context

The second act — an immersive portfolio journey — decomposes into three
independently shippable stages:

1. **The choice moment** (this spec): the signpost carries engraved words, the
   camera settles on it, and the visitor picks a road before going further.
2. **The swamp route**: the work road veers right and runs much further back,
   through a swamp graveyard of engraved song stones, with a dirt path on both
   roads and the pacing corrected.
3. **The rider's building**: an interior with the about wall and socials, a
   Ghost Rider-styled figure, a motorcycle outside, and an exit that continues
   to the church.

Each stage produces something walkable and judgeable on its own. This spec
covers stage 1 only.

## Problem

Today the signpost's two options are HTML buttons floating over the 3D post,
and the camera slides past them at a pace that puts them out of frame before
the fork. The choice reads as web furniture pasted onto a world, and it is easy
to miss entirely.

## Decision

The words are **carved into the sign** and the sign itself is clickable. The
journey **stops at the signpost** until a road is chosen.

## Parking the camera

Scroll is not locked, intercepted, or fought. Instead the document is only as
long as the journey unlocked so far:

- The master timeline's `ScrollTrigger` is pinned to a **fixed scroll
  distance** representing the whole journey (`end: '+=<fullRouteHeightPx>'`)
  rather than to the element's own height. Progress is therefore measured
  against the full journey no matter how tall the document currently is.
- Before a choice, `#scroll-track` is only tall enough to reach the signpost —
  `T_FORK_SCROLL` of the full journey height, plus a viewport. Because
  progress is measured against the full distance, scrolling to the very bottom
  advances the timeline exactly to the fork and no further.
- Choosing a road grows the track to that route's full height and calls
  `ScrollTrigger.refresh()`; scrolling then continues from where the visitor
  stands.

That distinction matters: if the trigger ended at `bottom bottom` instead,
a short document would compress the *entire* journey — church and all — into
those few screens of scrolling, which is precisely the bug this design has to
avoid.

This is the mechanism the existing route switch already uses, so it is proven
rather than new. The camera's resting position is chosen to frame the sign
legibly — fixing, as a side effect, the current problem of the sign leaving
frame before the fork.

If the visitor idles at the sign without choosing, a quiet prompt fades in.
That is the insurance against a parked page reading as a broken one.

## The engraved words

Each arm's text is rendered to a transparent canvas — dark, slightly softened
letterforms — and applied to a thin plane sitting just proud of the arm's
face, angled with it. The board keeps its own weathered material; the text
plane only carries letters. Rendering text separately from the board means
copy can change without touching geometry or the board's material.

Hovering an arm lights its letters and switches the cursor to a pointer;
moving away restores both.

## Clicking the sign

Pointer events raycast from the camera through the pointer against the two arm
meshes, each tagged in `userData` with the route it selects. A hit chooses that
route through the existing route state, which already refuses the choice once
the visitor is past the fork.

Raycasting runs on pointer move (throttled to animation frames) and on click —
never in a loop of its own.

## Keyboard and assistive technology

Carved text is invisible to assistive technology, so the scene is paired with
two real, focusable controls in the DOM: visually hidden (clipped, not
`display: none`, so they stay focusable and announced) and labelled with the
same words. They are **not** projected onto their arms — since they are never
seen, tracking them to screen positions would be needless per-frame work.
Tabbing to one highlights the corresponding arm in the scene; Enter or Space
chooses that road. Sighted pointer users only ever see carved wood; keyboard
and screen-reader users get a genuine, announced path.

The reduced-motion and no-WebGL fallbacks already present the whole site as a
flat document, so in those modes the two controls are simply visible links.

## What this replaces

The `.label-sign` DOM element and its two `.sign-arm` buttons are removed. The
label layer itself stays — the credit and crypt labels still use it, until
stage 2 replaces them with engraving.

## Testing

Pure and unit-testable: the track height for a given route and choice state;
the mapping from a raycast hit to a route; the idle-prompt delay; and the rule
that a choice is refused once past the fork (already covered).

Rendering, hover highlighting, and the parked framing are verified visually
with the existing headless-Chrome screenshot driver, including a keyboard-only
pass that tabs to each control and activates it.

## Explicitly out of scope for this stage

Engraved gravestone text, the extended swamp route, the dirt path on the work
road, the work-route pacing fix, the rider's building, the character, and the
motorcycle. Stages 2 and 3 own those, and doing them here would be work thrown
away when the route geometry changes.
