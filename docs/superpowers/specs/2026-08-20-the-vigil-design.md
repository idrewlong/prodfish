# The Vigil — Design Spec

**Date:** 2026-08-20
**Supersedes:** `2026-08-20-chapel-stations-design.md` (the vertical-stations
design, built and rejected on sight — see Problem below)

## Problem

The chapel's destination navigation was a horizontal carousel with a row of
dot buttons under the content. It worked, but it read as web chrome dropped on
a 3D scene, and two of three panels sat off-screen and inert.

The first attempt at fixing it replaced the carousel with three vertical
stations and a sticky anchor nav. That was built, and it was worse:

- **It erased the scene.** The carousel's saving grace was that its content
  stayed inside one screen-sized panel, so its scrim was one soft field with
  the altar visible around it. Stretched down a ~2000px column, the same scrim
  became a flat slab that covered the chapel entirely — sixteen screens of
  journey arriving at an altar you could no longer see.
- **The sticky nav was a dark bar pinned to the top of the viewport.** It read
  as a generic website header, which is the specific thing the codebase's own
  CSS comments had already rejected once: "a hard edge reads as flat UI dropped
  on the 3D scene."
- Acres of dead air between stations, roman numerals too small to read as
  structure, and display-size italic Cormorant stretched thin at `0.3em`
  letterspacing.

The lesson, stated plainly so it is not relearned: **content at the chapel must
stay within one screen, because the altar behind it is the payoff of the whole
site.**

## Decisions

### The destination is one screen again

Carousel-like: one content panel visible at a time, the scrim hugging that
panel, the altar and stonework visible around it. Sections change in place.

### Navigation is the altar itself — the Vigil

`src/world/candles.js` already places fourteen candles on the altar with flame
sprites, per-candle point lights and a scripted ignition beat. Three more join
them on the front rail, set apart from the ambient fourteen, and they are the
navigation:

- **The lit candle is the section you are in.** The other two are dark wicks
  with a thread of smoke.
- **They cost at most one new point light, and zero on a weak device.**
  `createCandles()` allocates a fixed pool of `maxLights` (from
  `settings.candleLights`, which the device tier sets) and walks it across the
  most recently lit candles. The nav candles draw the *active* light from that
  same pool rather than adding to it, so the scene's light count is unchanged.
  Flame sprites are cheap and always render, so a tier with no light to spare
  still shows which candle is lit.
- **Beneath them, three labels cut into a stone lintel** across the altar face:
  *beats · the work · about*. The lintel is **DOM, not geometry** — a styled
  surface behind the labels, not a mesh. Text that must stay crisp and
  selectable at 0.62rem belongs in the document; a mesh would only add a
  registration problem between two coordinate systems that resize
  independently.

The labels are the actual controls. They are real DOM `<button>`s with 44px
targets, `aria-current`, and arrow-key support. **The candles are the
indicator, never the mechanism.** This is not decoration over a hack: baking
text into 3D would fail legibility at small sizes, fail screen readers, and
fail keyboard focus. The lintel gives the labels a surface to sit on, which is
what stops them reading as floating web text over a render.

### Switching sections is one GSAP timeline

1. The lit flame gutters — sprite scale down, point-light intensity to zero, a
   brief smoke puff.
2. A spark travels along the rail toward the chosen candle.
3. The new wick catches — flame scales up with a small overshoot, light ramps.
4. The content panel crossfades on the same timeline.

No horizontal slide. The travelling flame already carries the motion, and
sliding underneath it would be two competing gestures.

### ScrollTrigger's place is the arrival, not the destination

As the camera settles at the altar, the three nav candles catch one after
another, then two gutter and leave the first lit. It says "these three are
yours" with no tooltip, and it hangs off the master scroll timeline that
already exists.

**Scroll does not advance sections.** That is the nested-scroll trap the
stations attempt fell into — a scroll container inside a scroll container
inside a Lenis-smoothed page. The destination is a single screen and stays one.

### Reduced motion

Instant section swap, no flame travel, no spark, no ignition sequence — the
correct candle is simply lit. Delivered through `gsap.matchMedia()` so GSAP
reverts what it created, rather than a second mechanism racing the `.reduced`
class.

## What carries over

- **`trackPxWithChapel()`** (committed) stays. With a one-screen chapel it is
  a no-op, and it is correct and defensive if that ever changes.
- The **`ResizeObserver`** that re-measured the chapel is dropped as YAGNI: the
  chapel is one viewport again and its content is capped inside a panel.
- **`src/stations.js` and `tests/stations.test.js`** (committed) are superseded
  and get replaced by the vigil module.
- **The about redesign and the featured beats ledger** from the stations plan
  still apply unchanged — those were content decisions, not container ones:
  - About: asymmetric two-column, credo stated, bio left-aligned and measured,
    email as a real bordered destination, socials below it.
  - Beats: a typographic featured ledger above the retained BeatStars embed,
    no audio on this origin, plus releasing the ambience when the visitor
    reaches into the cross-origin player.

## Non-goals

- No self-hosted audio. Settled earlier: the embed stays for file hygiene, and
  the producer tag is what protects a beat, not the hosting.
- No new downloaded 3D assets, and no new geometry. The nav candles reuse the
  existing candle system; the lintel is DOM.
- No change to the journey, the acts, the loading sequence, or `duckLevel`'s
  scroll behaviour.
- No new dependencies.

## Constraints

- **The altar must remain visible** around the content panel at every viewport.
  This is the acceptance criterion the last attempt failed.
- **Contrast floor:** body text at `rgba(216, 211, 200, α)` with `α ≥ 0.55`.
- **Touch targets:** 44px minimum on every control.
- **The candles are progressive enhancement.** With no WebGL, no JS, or reduced
  motion, the lintel labels alone must fully operate the sections. Nothing may
  depend on a flame existing.
- **`SOCIALS` ↔ JSON-LD `sameAs`** stays enforced by `tests/portfolio.test.js`.
- **The noscript path keeps working:** beats and contact are static markup;
  credits and bio are injected and hidden without JS.
- **Placeholder content stays placeholder** and renders as honestly inert text.
- **No horizontal document overflow at any viewport**, enforced by e2e.
- **Restraint over ornament.** The user has rejected a red radial outerglow as
  "too much" once already. Flames are small and warm; no bloom, no red wash.
