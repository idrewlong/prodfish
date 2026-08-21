# Chapel Stations — Design Spec

**Date:** 2026-08-20
**Supersedes:** the carousel described in `2026-08-10-portfolio-fork-design.md`

## Problem

The chapel is the destination of a sixteen-screen journey, and on arrival the
interaction model changes. `.panels` is a horizontal carousel nested inside a
vertically-scrolling panel nested inside a Lenis-smoothed page scroll — three
gesture models on one rectangle, with a swipe handler that must disambiguate
vertical drags from horizontal ones (`panels.js`, the `pointercancel` block).
Two of the three panels are `visibility: hidden`, parked off-screen behind
arrows the visitor has no reason to expect after fifteen screens of scrolling.

The CSS records the cost. `max-height: min(78dvh, calc(100dvh - 17rem))` is a
chrome budget subtracted by hand, and the comments around it read: "the
original bug", "sliced in half by the clip edge", "swallowed the end of the
bio". The container is fighting the content.

Two further problems, independent of the carousel:

- **About** is three centred blocks of near-identical weight, so nothing leads.
  Centred body copy at a 32rem measure gives every line a ragged left edge.
  `beats from the dark south` is the positioning line — it is in the `<title>`,
  the OG tags and the JSON-LD, and appears nowhere on the page. The email is
  the business ask and is set smaller than the bio.
- **Beats** hands the emotional peak of the site to a cross-origin iframe that
  renders BeatStars' design system inside the chapel.

## Decisions

### The carousel goes; the chapel becomes three vertical stations

Beats, work and about stack in one column. The visitor keeps doing the one
thing they have done for the whole approach. This deletes the horizontal
strip, the swipe handler, the `inert` toggling, the per-panel scroll container,
the overflow-fade machinery and the height cap.

A sticky mono nav (`beats · work · about`) pins at the top of the chapel and
scroll-spies. It carries the same three labels the dots did, but as real
anchors that also function as a table of contents.

### Scroll geometry: the chapel's overflow extends the track

**This is the load-bearing constraint.**

`#scroll-track` is `journeyTrackPx(V) = 16V` and `#chapel` is `position:
absolute; bottom: 0; min-height: 100dvh` — it occupies exactly the last
viewport. Its top edge sits at document `y = 15V`, which is where the master
timeline ends.

A taller chapel grows *upward*, so its top edge moves earlier in the document
and it starts framing itself mid-journey — the precise "position shifts" jump
that the ACT 5 opacity ramp exists to prevent.

The track therefore grows by exactly the chapel's overflow:

```
E     = max(0, chapelPx - V)      // how much taller than one viewport
track = journeyTrackPx(V) + E     // 16V + E
```

The chapel still occupies the bottom `V + E`, so its top edge stays at
`y = 16V + E - (V + E) = 15V` — unchanged. The journey timeline still spans
`journeyDistancePx(V) = 15V`, ends at the same scroll position it always did,
and the extra `E` pixels are pure post-journey scroll that reveal stations two
and three. Nothing about the camera, the acts, or the audio duck moves.

`E` is measured from the laid-out chapel, which is safe to measure: `#chapel`
is absolutely positioned and full-width, so its height depends on its content
and the viewport width, never on the track height. No circularity.

### Beats: own the browsing, let BeatStars own the transaction

The embed stays. Not because it is more secure — BeatStars streams MP3s to the
browser exactly as a self-hosted file would, and anyone with a network tab can
take either. The real protection for beats is the producer tag, not the
hosting. The embed stays for **file hygiene**: audio that never touches this
origin can never be accidentally published untagged.

What changes is everything around it:

- A **featured ledger** above the embed — four to six beats as pure typography
  in the existing `.work-list` style (title in Cormorant italic, `bpm · key` in
  mono, hairline between). No audio on this origin. This is where the design
  work and the seduction happen.
- The embed below it, framed hard as an object rather than a section, so the
  visual mismatch reads as a screen set into stonework rather than a seam.
- Beats and credits become the same visual object: one ledger *for sale*, one
  *released*.

`.player-fallback` is kept exactly as it is. It is the best-designed part of
that section and it matters more now that the embed is load-bearing.

### Beats: release the ambience on player engagement

`duckLevel()` already drops the ambience to 15% by scroll position on arrival,
so crickets-over-a-track is largely handled. What it cannot know is when
someone actually presses play inside a cross-origin frame.

When a visitor clicks into a cross-origin iframe, the parent window fires
`blur` and `document.activeElement` becomes that iframe. On that signal, stop
the ambience outright and flip `#sound` to its off state so the toggle stays
truthful about what is audible. It is a heuristic — it fires on any click into
the frame, not strictly on play — but it fails safe.

### About: asymmetric, left-aligned, one ask

- **Left:** the credo — *beats from the dark south* — large, Cormorant italic,
  left-aligned, `text-wrap: balance`. The one place the brand states itself.
- **Right:** the bio, left-aligned, 60–70ch.
- **Below, full width:** custom work as a real destination — the email in a
  bordered target reusing the altar's red-hairline treatment.
- **Socials last**, small mono row beneath the email. They currently sit above
  the ask, so the final element before the footer is an exit link.

Stacks to one column below 720px. Nothing centred except the station heading.

### Station headings

A mono numeral, the title, and a hairline running to the right edge. This gives
the vertical column the structure the carousel dots used to provide.

## Non-goals

- No self-hosted audio, no waveforms, no native player. Settled above.
- No change to the journey, the 3D scene, the acts, the loading sequence, or
  `duckLevel`'s scroll behaviour.
- No new dependencies.

## Constraints

- **Contrast floor:** every `rgba(216, 211, 200, α)` on body text is `α ≥ 0.55`.
  That is exactly where 4.5:1 is met against `#050607`; 0.5 does not.
- **Touch targets:** 44px minimum on every control.
- **`SOCIALS` ↔ JSON-LD `sameAs`** must stay identical. Enforced by
  `tests/portfolio.test.js`.
- **The noscript path must keep working.** Beats and contact are static markup
  and must render without JS; credits and bio are injected and stay hidden.
- **`prefers-reduced-motion` and the no-WebGL path** lay the page out in flow
  (`#scroll-track { height: auto }`, `#chapel { position: relative }`). Vertical
  stations must work there with no extra code.
- **Placeholder content stays placeholder.** `storeId`, `CREDITS` and `BIO` are
  still `PLACEHOLDER`; `FEATURED` joins them. Rows without a real URL render as
  honestly inert text, exactly as `creditLink()` already does.
- **No horizontal document overflow at any viewport.** Enforced by the e2e
  layout test.
