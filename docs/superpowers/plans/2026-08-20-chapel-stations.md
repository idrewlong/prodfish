# Chapel Stations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the chapel's horizontal carousel with three vertical stations, and redesign the beats and about sections around them.

**Architecture:** The chapel grows from one viewport to a three-station column; the scroll track grows by exactly the chapel's overflow so the journey timeline is untouched. Navigation becomes a sticky anchor nav with scroll-spy. Beats gains a typographic featured ledger above the (retained) BeatStars embed; about becomes an asymmetric two-column credo with one clear ask.

**Tech Stack:** Vanilla ES modules, Vite 8, GSAP 3 (core + ScrollTrigger), Lenis, Vitest (unit), Playwright (e2e). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-20-chapel-stations-design.md`

## Global Constraints

- **Contrast floor:** body text uses `rgba(216, 211, 200, α)` with `α ≥ 0.55`. That is exactly 4.5:1 against `#050607`; `0.5` fails. Never lower an existing alpha.
- **Touch targets:** every control is at least 44px in both axes.
- **`SOCIALS` must equal the JSON-LD `sameAs`** in `index.html`. Enforced by `tests/portfolio.test.js`.
- **No new dependencies.** `package.json` does not change.
- **No horizontal document overflow at any viewport** (375×667 through 1920×1080). Enforced by `tests/e2e/smoke.spec.js`.
- **The noscript path must keep working:** beats and contact are static markup; credits and bio are JS-injected and stay hidden without JS.
- **The reduced-motion and no-WebGL paths** set `#scroll-track { height: auto }` and `#chapel { position: relative }` and never run the scroll timeline. Everything must work there with no extra JS.
- **Placeholder content stays placeholder.** Rows without a real URL render as honestly inert text, never as dead links.
- **Do not touch** `src/world/`, `src/scenes/`, `src/timeline.js`, `src/choreography.js`, or the loading sequence in `src/main.js` (lines ~30–200).
- **Colour tokens only:** `--bone #d8d3c8`, `--blood #c1170f`, `--blood-dim #5a0a06`, `--night #050607`. Fonts: `--serif` Cormorant Garamond, `--mono` IBM Plex Mono, `--blackletter` UnifrakturMaguntia.
- **Run `npm test` after every task.** Run `npm run test:e2e` after tasks 3, 4 and 5.

---

### Task 1: Grow the scroll track by the chapel's overflow

The chapel is `position: absolute; bottom: 0; min-height: 100dvh` inside a track of `journeyTrackPx(V) = 16V`, so its top edge sits at `y = 15V` — exactly where the master timeline ends. A taller chapel grows upward and starts framing itself mid-journey. Growing the track by the overflow keeps the top edge at `15V` and appends the extra scroll after the journey.

This is a no-op while the chapel is one viewport tall, so it lands safely before any markup changes.

**Files:**
- Modify: `src/journey.js` (append after `journeyTrackPx`)
- Modify: `src/main.js:255-259` (the `sizeTrack` closure)
- Test: `tests/journey.test.js`

**Interfaces:**
- Consumes: `journeyTrackPx(viewportPx)` from `src/journey.js`
- Produces: `trackPxWithChapel(viewportPx: number, chapelPx: number) => number`

- [ ] **Step 1: Write the failing test**

Append to `tests/journey.test.js`:

```js
import { JOURNEY_VH, journeyDistancePx, journeyTrackPx, trackPxWithChapel } from '../src/journey.js';

describe('trackPxWithChapel', () => {
  it('changes nothing when the chapel is one viewport tall', () => {
    expect(trackPxWithChapel(800, 800)).toBe(journeyTrackPx(800));
  });

  it('adds only the pixels the chapel exceeds one viewport by', () => {
    // Three stations on an 800px viewport: the journey keeps its 16 screens
    // and the extra 1600px becomes post-journey scroll.
    expect(trackPxWithChapel(800, 2400)).toBe(journeyTrackPx(800) + 1600);
  });

  it('never shrinks the track for a chapel shorter than the viewport', () => {
    expect(trackPxWithChapel(800, 200)).toBe(journeyTrackPx(800));
  });

  it('leaves exactly the journey above the chapel, whatever the chapel weighs', () => {
    // The invariant the whole change rests on. track = 15V + C, so the
    // document ABOVE the chapel is always 15V — journeyDistancePx — and the
    // chapel's top edge lands where the timeline ends no matter how tall it
    // grows. If this breaks, the chapel starts framing itself mid-walk.
    for (const chapelPx of [800, 2400, 5000]) {
      expect(trackPxWithChapel(800, chapelPx) - chapelPx).toBe(journeyDistancePx(800));
    }
    expect(journeyDistancePx(800)).toBe((JOURNEY_VH / 100 - 1) * 800);
  });

  it('treats an unmeasured chapel as no overflow', () => {
    // offsetHeight is 0 before layout and NaN never reaches here, but a
    // track sized to NaN is a blank page — so both are pinned.
    expect(trackPxWithChapel(800, 0)).toBe(journeyTrackPx(800));
    expect(trackPxWithChapel(800, NaN)).toBe(journeyTrackPx(800));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- journey`
Expected: FAIL — `trackPxWithChapel is not a function`

- [ ] **Step 3: Write the implementation**

Append to `src/journey.js`:

```js
// The chapel is `position: absolute; bottom: 0` inside the track, so it always
// occupies the track's LAST pixels and grows upward. At one viewport tall its
// top edge lands at 15V — exactly where the master timeline ends. Left alone, a
// three-station chapel would put that edge at 13V and start framing itself
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- journey`
Expected: PASS

- [ ] **Step 5: Wire it into `sizeTrack`**

In `src/main.js`, update the import on line 9-ish to add `trackPxWithChapel`:

```js
import { journeyDistancePx, journeyTrackPx, trackPxWithChapel, viewportBasis, resetViewportBasis } from './journey.js';
```

(Check the existing import line and add only `trackPxWithChapel` to it; leave the other names as they are.)

Then replace the `sizeTrack` closure in `boot()`:

```js
  const track = document.getElementById('scroll-track');
  const chapel = document.getElementById('chapel');
  const sizeTrack = () => {
    const basis = viewportBasis(window.innerHeight);
    track.style.height = `${trackPxWithChapel(basis, chapel?.offsetHeight ?? 0)}px`;
  };
  sizeTrack();
```

- [ ] **Step 6: Verify nothing moved**

Run: `npm test`
Expected: PASS, all files.

Run: `npm run test:e2e -- --grep layout`
Expected: PASS. The chapel is still one viewport tall at this point, so the track height must be byte-identical to before.

- [ ] **Step 7: Commit**

```bash
git add src/journey.js src/main.js tests/journey.test.js docs/superpowers
git commit -m "feat(journey): let the chapel's own height extend the scroll track

The chapel is pinned to the bottom of the track, so a taller chapel grows
upward into the journey and starts framing itself before the camera has
settled. The track now absorbs the overflow, holding the chapel's top edge
at 15V where it has always been. No-op until the chapel actually grows.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The scroll-spy module

A pure function deciding which station the visitor is looking at, plus the DOM wiring. Split from the markup swap because it is independently testable and reviewable.

**Files:**
- Create: `src/stations.js`
- Test: `tests/stations.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `activeStation(scrollY: number, viewportPx: number, tops: number[]) => number`
  - `createStations(root: Element) => { sync: () => void }`
  - `wireStationLinks(root: Element, lenis: { scrollTo: Function }) => void`

- [ ] **Step 1: Write the failing test**

Create `tests/stations.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { activeStation } from '../src/stations.js';

// Three stations on an 800px viewport, each one screenful apart.
const TOPS = [1000, 1800, 2600];
const V = 800;

describe('activeStation', () => {
  it('reads the first station before the reading line reaches the second', () => {
    // The line sits 40% down the viewport: at scrollY 1000 it is at 1320,
    // which is inside the first station and short of the second.
    expect(activeStation(1000, V, TOPS)).toBe(0);
  });

  it('advances once the reading line crosses a station top', () => {
    // Line at 1800 exactly — the second station's top.
    expect(activeStation(1480, V, TOPS)).toBe(1);
    expect(activeStation(2280, V, TOPS)).toBe(2);
  });

  it('does not advance a moment early', () => {
    // One pixel short of the second station's top.
    expect(activeStation(1479, V, TOPS)).toBe(0);
  });

  it('stays on the last station at the bottom of the document', () => {
    expect(activeStation(99999, V, TOPS)).toBe(2);
  });

  it('reads the first station above the whole column', () => {
    // Most of the journey happens here: the chapel is far below.
    expect(activeStation(0, V, TOPS)).toBe(0);
  });

  it('survives having no stations at all', () => {
    expect(activeStation(500, V, [])).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- stations`
Expected: FAIL — cannot resolve `../src/stations.js`

- [ ] **Step 3: Write the implementation**

Create `src/stations.js`:

```js
// The chapel is three stations in one column, not a carousel. Everything here
// is real markup in normal flow — nothing is hidden, transformed off-screen or
// made inert — so keyboard users, screen readers and crawlers get the whole
// catalog and bio by scrolling, the same way everyone else does.
//
// This module owns only the sticky nav: which link is marked current, and
// (once Lenis exists) turning the anchors into smooth jumps.

// Which station the visitor is reading. The decision is made against a line
// 40% down the viewport rather than its top edge: a station whose heading has
// only just appeared at the very bottom of the screen is not what anyone is
// looking at, and marking it current makes the nav twitch a beat ahead of the
// reader. `tops` are document-space offsets, ascending.
export function activeStation(scrollY, viewportPx, tops) {
  if (!tops.length) return 0;
  const line = scrollY + viewportPx * 0.4;
  let active = 0;
  for (let i = 0; i < tops.length; i++) {
    if (tops[i] <= line) active = i;
  }
  return active;
}

export function createStations(root) {
  const stations = [...root.querySelectorAll('.station')];
  const links = [...root.querySelectorAll('.station-nav a')];
  if (!stations.length || !links.length) return { sync: () => {} };

  function sync() {
    // Measured every time rather than cached: the chapel sits at the bottom of
    // a track whose height is set from JS and re-set on rotation, so a cached
    // offset goes stale on exactly the devices least able to tolerate it.
    const tops = stations.map((s) => s.getBoundingClientRect().top + window.scrollY);
    const i = activeStation(window.scrollY, window.innerHeight, tops);
    links.forEach((link, n) => {
      link.setAttribute('aria-current', n === i ? 'true' : 'false');
    });
  }

  // Passive: this only ever reads layout and sets an attribute.
  window.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', sync, { passive: true });
  sync();
  return { sync };
}

// The nav links are real in-page anchors, so they work with no JS and on the
// static paths where the whole document is laid out in flow. This upgrades
// them to a Lenis jump for the animated path only — a native anchor jump there
// would teleport the scrubbed camera the length of the journey in one frame,
// which is the same reason wireSkip exists.
export function wireStationLinks(root, lenis) {
  for (const link of root.querySelectorAll('.station-nav a')) {
    link.addEventListener('click', (e) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      // Deliberately NOT stopPropagation: this is a real gesture and letting
      // it reach the window unlocks the ambience, same as any other tap.
      lenis.scrollTo(target, { duration: 1.4, lock: true });
    });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- stations`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/stations.js tests/stations.test.js
git commit -m "feat(stations): scroll-spy for the chapel's vertical nav

Not yet wired to anything — the markup swap is the next commit.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Replace the carousel with three vertical stations

The big one. Markup, CSS, wiring, tests. After this the site works end to end with the new layout; tasks 4 and 5 restyle the content inside it.

**Files:**
- Modify: `index.html` (the noscript block, `#skip`, and the whole `.panels` subtree)
- Modify: `src/style.css` (delete the carousel block ~lines 464–680 and the panel rules in the 520px media query; add station rules)
- Modify: `src/main.js` (swap `createPanels` for `createStations`, fix `wireSkip`, call `wireStationLinks`)
- Delete: `src/panels.js`, `tests/panels.test.js`
- Modify: `tests/e2e/smoke.spec.js` (layout suite and the player-fallback selector)

**Interfaces:**
- Consumes: `createStations(root)`, `wireStationLinks(root, lenis)` from Task 2; `trackPxWithChapel` from Task 1
- Produces: DOM contract for tasks 4–6 — `#station-beats`, `#station-work`, `#station-about`, each `<section class="station">`; the column wrapper is `.stations`; the nav is `.station-nav`

- [ ] **Step 1: Replace the markup in `index.html`**

Replace the entire `<div class="panels" ...>` element (from `<div class="panels"` through its closing `</div>`, immediately before `<footer class="chapel-footer">`) with:

```html
      <!-- The destination is a column, not a carousel. Beats, work and about
           are three stations the visitor scrolls through — the same gesture
           they have used for the whole approach, rather than a mode change on
           arrival. Everything is in normal flow: nothing hidden, nothing
           transformed off-screen, nothing inert.
           The chapel is therefore taller than one viewport, which the scroll
           track absorbs — see trackPxWithChapel in journey.js. -->
      <nav class="station-nav" aria-label="chapel sections">
        <a href="#station-beats">beats</a>
        <a href="#station-work">the work</a>
        <a href="#station-about">about</a>
      </nav>

      <div class="stations">
        <section class="station" id="station-beats" aria-labelledby="title-beats">
          <h2 class="station-title" id="title-beats">
            <span class="station-num" aria-hidden="true">i</span>the beats
          </h2>

          <!-- The player is a third-party embed on a slow, blockable origin,
               and it was framing 560px of pure black while it arrived —
               indistinguishable from a broken site. The fallback below sits
               behind it and says so.

               The iframe is opaque and visible by DEFAULT so the no-JS page is
               unaffected. main.js adds .player-pending, which makes the frame
               transparent and reveals the message, then removes it on the
               iframe's load event. If that event never comes — blocked,
               offline, bad store id — the message stays put instead of the
               void. -->
          <div class="altar-frame">
            <p class="player-fallback" aria-hidden="true">
              <span class="player-fallback-line player-waiting">the player is on its way</span>
              <span class="player-fallback-line player-late">the player is taking its time</span>
              <span class="player-fallback-sub">the whole catalog is one door over &mdash; open on beatstars, below</span>
            </p>
            <iframe
              src="https://player.beatstars.com/?storeId=PLACEHOLDER"
              title="prodfish beats on BeatStars"
              loading="lazy"
              allow="autoplay"
            ></iframe>
          </div>
          <a class="bs-link" href="https://www.beatstars.com/PLACEHOLDER" target="_blank" rel="noopener">
            open on beatstars &#8599;
          </a>
        </section>

        <section class="station" id="station-work" aria-labelledby="title-work">
          <h2 class="station-title" id="title-work">
            <span class="station-num" aria-hidden="true">ii</span>the work
          </h2>
          <!-- A ledger, not a list: artist left, track right, one rule
               between. Rows are links only where a real Spotify URL exists —
               see creditRow() in main.js. -->
          <ul class="work-list"></ul>
          <a class="bs-link work-catalog" target="_blank" rel="noopener">the full catalog &#8599;</a>
        </section>

        <section class="station" id="station-about" aria-labelledby="title-about">
          <h2 class="station-title" id="title-about">
            <span class="station-num" aria-hidden="true">iii</span>about
          </h2>
          <p class="work-bio"></p>
          <nav class="work-socials" aria-label="social links"></nav>
          <p class="contact">
            <span class="contact-label">custom work</span>
            <a class="contact-mail" href="mailto:beats@prodfish.com">beats@prodfish.com</a>
          </p>
        </section>
      </div>
```

- [ ] **Step 2: Point `#skip` at the beats station**

In `index.html`, change the skip link's target:

```html
  <a id="skip" href="#station-beats">skip to the beats</a>
```

- [ ] **Step 3: Update the noscript block**

In `index.html`, replace these three lines inside `<noscript><style>`:

```css
      .panel { max-height: none; overflow: visible; }
      .panel-strip { display: block; }
      /* The whole nav cluster goes: with no JS the strip is laid out as
         stacked blocks, so there is nothing left to page between. */
      .panel-nav { display: none; }
```

with:

```css
      /* The stations are already stacked blocks in flow; the sticky nav needs
         no JS to work either, since these are real in-page anchors. */
      .station-nav { position: static; }
```

and replace the last line:

```css
      #panel-work, #panel-about .work-bio, #panel-about .work-socials { display: none; }
```

with:

```css
      #station-work, #station-about .work-bio, #station-about .work-socials { display: none; }
```

- [ ] **Step 4: Delete the carousel CSS**

In `src/style.css`, delete every rule from the comment `/* ---------- the altar panels: beats / the work / about ---------- */` down to and including `.panel-dot[aria-current='true'] { ... }` — **except** keep `.panels::before` and its `@media (max-width: 640px)` companion, which you will rename in the next step.

Concretely, delete these selectors entirely: `.panels`, `.panel-viewport::after`, `.panel-viewport.has-overflow::after`, `.panel-viewport.at-scroll-end::after`, `#chapel { overflow-x: clip; }`, `.panel-viewport, .panel-nav`, `.panel-viewport`, `.panel-strip`, `.panel`, `.panel::-webkit-scrollbar`, `.panel::-webkit-scrollbar-thumb`, `.panel[aria-hidden='true']`, `.panel-nav`, `.panel-arrow`, `.panel-arrow:hover:not(:disabled)`, `.panel-arrow:disabled`, `.panel-dots`, `.panel-dot`, `.panel-dot[aria-current='true']`.

In the focus block, replace `.panel-arrow:focus-visible,` and `.panel-dot:focus-visible,` with `.station-nav a:focus-visible,`.

In the `@media (max-width: 520px)` block, delete these two lines:

```css
  .panel-dots { gap: 0.7rem; }
  .panel-dot { letter-spacing: 0.2em; }
```

- [ ] **Step 5: Add the station CSS**

In `src/style.css`, in place of the block you deleted, add:

```css
/* ---------- the chapel: three stations in one column ---------- */
/* The destination is a column the visitor scrolls, not a carousel they page.
   #chapel is therefore taller than one viewport; trackPxWithChapel() in
   journey.js grows the scroll track to match so this height is appended after
   the journey rather than stolen from it. */

/* The scrim. The chapel's neon cross sits directly behind this content, and on
   a phone the credit list landed straight across its arms — "delta psalm" and
   "kerosene choir" were reading as bone text on saturated red.
   A card with a border would fix it, but the altar frame's own notes already
   record why that was rejected once: a hard edge reads as flat UI dropped on
   the 3D scene. So this is a soft field of night instead, bleeding out well
   past the text and reaching zero before it meets any edge — the scene still
   shows through at the margins and there is nothing to see as a box.
   Deliberately not backdrop-filter: blurring a live 3D canvas every frame is
   real GPU cost on exactly the phones the low tier exists to protect. */
.stations {
  position: relative;
  width: min(760px, 94vw);
  display: flex;
  flex-direction: column;
}
.stations::before {
  content: '';
  position: absolute;
  /* Generous, because the falloff has to finish OUTSIDE the text. See the
     media query below for phones, where the column is nearly the full viewport
     and the fade has to be pushed off-screen entirely. */
  inset: -4% -22%;
  /* A soft-edged rectangle, not an ellipse. The first attempt here was a
     radial gradient, and on a tall phone its falloff started so early that the
     top rows sat outside the dark core entirely. This holds near-full opacity
     across the whole content column instead, and gets its softness from fading
     out on all four sides: the linear-gradient fades top and bottom, the mask
     fades left and right. No edge anywhere, and no weak middle. */
  background: linear-gradient(
    to bottom,
    rgba(3, 2, 2, 0) 0%,
    rgba(3, 2, 2, 0.93) 4%,
    rgba(3, 2, 2, 0.93) 96%,
    rgba(3, 2, 2, 0) 100%
  );
  -webkit-mask-image: linear-gradient(
    to right,
    transparent 0%, #000 12%, #000 88%, transparent 100%
  );
  mask-image: linear-gradient(
    to right,
    transparent 0%, #000 12%, #000 88%, transparent 100%
  );
  pointer-events: none;
  z-index: 0;
}

.station {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.4rem;
  /* Generous vertical air is what separates the stations from each other —
     there is no card, no border and no rule between them, only distance. */
  padding: 4.5rem 0;
}
.station:first-child { padding-top: 1.5rem; }
.station:last-child { padding-bottom: 2rem; }

/* A mono numeral, the title, and a hairline out to the right edge. This is the
   structure the carousel's dots used to supply: in a column, each station has
   to announce itself. */
.station-title {
  display: flex;
  align-items: baseline;
  gap: 0.9rem;
  width: 100%;
  font-family: var(--serif);
  font-weight: 400;
  font-style: italic;
  font-size: clamp(1.6rem, 4vw, 2.6rem);
  letter-spacing: 0.3em;
  color: var(--bone);
  text-shadow: 0 0 30px rgba(193, 23, 15, 0.55);
}
.station-title::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, rgba(193, 23, 15, 0.5), transparent);
  /* Sits on the title's baseline rather than its centre — the letterforms are
     italic and a centred rule reads as striking through them. */
  transform: translateY(-0.35em);
}
.station-num {
  font-family: var(--mono);
  font-style: normal;
  font-size: 0.7rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: rgba(216, 211, 200, 0.55);
}

/* ---------- the sticky station nav ---------- */
/* Three real in-page anchors. They work with no JS and on the static paths;
   main.js upgrades them to a Lenis jump on the animated one (see
   wireStationLinks). aria-current is set by the scroll-spy in stations.js. */
.station-nav {
  position: sticky;
  top: 0;
  z-index: 3;
  align-self: stretch;
  display: flex;
  justify-content: center;
  gap: 1.2rem;
  /* Its own ground: sticky over a live 3D canvas needs something behind it or
     the labels swim through whatever the camera is looking at. */
  background: linear-gradient(to bottom, rgba(3, 2, 2, 0.94) 55%, rgba(3, 2, 2, 0));
  padding: 0.6rem 1rem 1.4rem;
  margin-bottom: -0.6rem;
}
.station-nav a {
  color: rgba(216, 211, 200, 0.55);
  font-family: var(--mono);
  font-size: 0.62rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  text-decoration: none;
  border-bottom: 1px solid transparent;
  /* 44px of touch target regardless of how small the label renders. */
  padding: 0.6rem 0.35rem;
  min-height: 44px;
  display: flex;
  align-items: center;
  transition: color 0.25s, border-color 0.25s;
}
.station-nav a:hover { color: var(--bone); }
.station-nav a[aria-current='true'] {
  color: var(--bone);
  border-bottom-color: var(--blood);
}

@media (max-width: 520px) {
  .station-nav { gap: 0.5rem; }
  .station-nav a { letter-spacing: 0.16em; }
}
```

- [ ] **Step 6: Let the chapel be a column**

In `src/style.css`, in the `#chapel` rule, change `justify-content: center;` to:

```css
  /* A column of stations taller than the viewport, so it stacks from the top.
     `center` here would have hung the whole column off the vertical middle of
     a box that is now much taller than one screen. min-height still guarantees
     a full screen when the content is short. */
  justify-content: flex-start;
```

In the same rule, change `gap: 2rem;` to `gap: 0;` (the stations own their own spacing now) and leave everything else — the opacity ramp, the pointer-events, the gradient, the safe-area padding — untouched.

- [ ] **Step 7: Rewire `main.js`**

Replace the import of `panels.js`:

```js
import { createStations, wireStationLinks } from './stations.js';
```

Replace the `createPanels` call near the bottom:

```js
// The stations are the site's only navigation, so they are wired up
// unconditionally — including on the reduced-motion and no-WebGL paths, which
// never boot the 3D scene but still need the catalog and the bio.
const stationRoot = document.getElementById('chapel');
if (stationRoot) createStations(stationRoot);
```

Replace `wireSkip` entirely:

```js
// The skip control is a real <a href="#station-beats">, so it works with no JS
// and on the static paths. Here it is upgraded to a smooth Lenis jump, because
// a native anchor jump would teleport the scrubbed camera the entire length of
// the journey in one frame.
function wireSkip(lenis, sizeTrack) {
  const skip = document.getElementById('skip');
  const beats = document.getElementById('station-beats');
  if (!skip || !beats) return;
  skip.addEventListener('click', (e) => {
    e.preventDefault();
    // Deliberately NOT stopPropagation: this is a real gesture and letting it
    // reach the window unlocks the ambience, same as any other first tap.
    sizeTrack();
    // The station, not document.scrollHeight. The chapel is three stations
    // tall now, so the bottom of the document is the ABOUT section — scrolling
    // there would skip past the very thing the control offers.
    lenis.scrollTo(beats, { duration: 2.2, lock: true });
  });
}
```

In `boot()`, after `wireSkip(lenis, sizeTrack);` add:

```js
  wireStationLinks(document.getElementById('chapel'), lenis);
  // The stations were measured against a track that had not yet been sized.
  ScrollTrigger.refresh();
```

- [ ] **Step 8: Delete the carousel module and its tests**

```bash
git rm src/panels.js tests/panels.test.js
```

- [ ] **Step 9: Update the e2e layout suite**

In `tests/e2e/smoke.spec.js`, replace the body of the `fits at ...` test (everything after `await settled(page);`) with:

```js
      // Scrollability, not scrollWidth: a column that overflows its container
      // is clipped from view, so the only symptom is that the page drags
      // sideways onto blank ground. Nothing else catches that — it looks
      // perfect in a screenshot.
      const dragged = await page.evaluate(() => {
        window.scrollTo(9999, 0);
        const x = window.scrollX;
        window.scrollTo(0, 0);
        return x;
      });
      expect(dragged, 'px the page can be dragged sideways').toBeLessThanOrEqual(1);

      // Every station is in flow and visible now, so each one's content must
      // fit its own box — a bio or a credit row too wide for its station is
      // clipped with no way to reach it.
      const stations = page.locator('.station');
      const count = await stations.count();
      expect(count).toBe(3);
      for (let i = 0; i < count; i++) {
        const inner = await stations.nth(i).evaluate((el) => el.scrollWidth - el.clientWidth);
        expect(inner, `station ${i} overflows itself`).toBeLessThanOrEqual(1);
        const box = await stations.nth(i).boundingBox();
        expect(box, `station ${i} has no box`).not.toBeNull();
        expect(box.x, `station ${i} starts off-screen left`).toBeGreaterThanOrEqual(-1);
        expect(box.x + box.width, `station ${i} runs off-screen right`)
          .toBeLessThanOrEqual(width + 1);
      }
```

In the player-fallback suite, change the scoped selector:

```js
    await expect(page.locator('#station-beats .bs-link')).toBeVisible();
```

- [ ] **Step 10: Add an e2e test for the new navigation**

Append to `tests/e2e/smoke.spec.js`:

```js
test.describe('station nav', () => {
  test.use({ reducedMotion: 'reduce' });

  test('every station is reachable by scrolling, none are hidden', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await settled(page);
    // The carousel parked two of three panels off-screen behind arrows. The
    // whole point of the column is that this is no longer true.
    for (const id of ['#station-beats', '#station-work', '#station-about']) {
      await expect(page.locator(id)).toBeVisible();
    }
  });

  test('the nav marks the station you are looking at', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await settled(page);
    await page.locator('#station-about').scrollIntoViewIfNeeded();
    // The spy runs on scroll; give it a frame to settle.
    await expect(page.locator('.station-nav a[href="#station-about"]'))
      .toHaveAttribute('aria-current', 'true');
  });
});
```

- [ ] **Step 11: Run everything**

Run: `npm test`
Expected: PASS. `tests/panels.test.js` is gone; `tests/stations.test.js` and `tests/journey.test.js` pass.

Run: `npm run test:e2e`
Expected: PASS, all suites.

**This failed on first run, and the reasoning above was wrong.** Four layout viewports could drag sideways. `#chapel { overflow-x: clip }` was never only about the parked panels — it was also clipping `.panels::before`, whose overhang (`-22%`, and `-45%` on phones) is deliberately wider than the column so its falloff finishes off-screen. Removing the rule exposed that overhang as real document width.

Restore `#chapel { overflow-x: clip; }` in the stations block. `clip`, not `hidden`: hidden forces `overflow-y: auto`, which would make `#chapel` a scroll container and silently break the sticky nav — the page still looks correct until you scroll. That interaction is now guarded by the "nav stays pinned" e2e test.

Also note: `npx playwright test 2>&1 | tail -N` reports **tail's** exit code, not Playwright's. The first run of this task exited 0 with four failures. Read the summary line, never the exit code.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "refactor(chapel): three vertical stations instead of a carousel

The destination changed interaction model on arrival: a horizontal strip
nested in a scrolling panel nested in a smoothed page scroll, with two of
three panels parked off-screen and inert. It is a column now — the same
gesture the visitor has used for fifteen screens.

Deletes the swipe handler, the inert toggling, the per-panel scroll
container, the overflow fade and the hand-subtracted height cap that the
surrounding comments recorded as a running source of clipped content.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Redesign the about station

Asymmetric, left-aligned, with the credo stated and the ask last.

**Files:**
- Modify: `src/content/portfolio.js` (add `CREDO`)
- Modify: `index.html` (`#station-about` subtree)
- Modify: `src/style.css` (the `---------- about ----------` block)
- Test: `tests/portfolio.test.js`

**Interfaces:**
- Consumes: `#station-about` from Task 3
- Produces: `CREDO: string` exported from `src/content/portfolio.js`

- [ ] **Step 1: Write the failing test**

Append to the `portfolio content` describe block in `tests/portfolio.test.js`:

```js
  // The credo is the positioning line. It was already load-bearing in three
  // machine-readable places — the <title>, the meta description and the
  // JSON-LD — while appearing nowhere a visitor could read it. Now that it is
  // rendered in the about station, all four have to agree: a page whose
  // structured data claims a tagline the document does not say is precisely
  // the mismatch that gets structured data distrusted.
  it('states the credo the metadata already claims', () => {
    expect(CREDO.length).toBeGreaterThan(0);
    expect(jsonLd.description.toLowerCase()).toContain(CREDO.toLowerCase());
    const meta = html.match(/<meta name="description" content="([^"]+)"/)[1];
    expect(meta.toLowerCase()).toContain(CREDO.toLowerCase());
  });

  it('renders the credo in the about station, not just in the metadata', () => {
    // Static markup, so it survives the noscript path — which means it can
    // drift from the constant. This is what stops that.
    expect(html).toMatch(
      new RegExp(`<p class="about-credo">\\s*${CREDO}\\s*</p>`, 'i'),
    );
  });
```

Update the import at the top of the file to include `CREDO`:

```js
import { CREDITS, BIO, CATALOG_URL, SOCIALS, CREDO, creditLink } from '../src/content/portfolio.js';
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- portfolio`
Expected: FAIL — `CREDO.length` throws on undefined.

- [ ] **Step 3: Add the constant**

In `src/content/portfolio.js`, above `BIO`:

```js
// The positioning line, and the one place the brand states itself out loud.
// This exact string also appears in index.html's <title>, meta description and
// JSON-LD `description`, and is rendered as static markup in the about station
// — tests/portfolio.test.js holds all four in agreement.
export const CREDO = 'beats from the dark south';
```

- [ ] **Step 4: Rebuild the about markup**

In `index.html`, replace the contents of `#station-about` (everything after its `<h2>`) with:

```html
          <!-- Asymmetric on purpose. Three centred blocks of equal weight gave
               nothing to lead with, and centred body copy at this measure puts
               a ragged edge on the side the eye returns to. The credo leads,
               the bio explains, and the ask closes — in that order, with the
               socials below the email so the last thing before the footer is
               the business, not an exit link. -->
          <div class="about-grid">
            <p class="about-credo">beats from the dark south</p>
            <p class="work-bio"></p>
          </div>
          <p class="contact">
            <span class="contact-label">custom work</span>
            <a class="contact-mail" href="mailto:beats@prodfish.com">beats@prodfish.com</a>
          </p>
          <nav class="work-socials" aria-label="social links"></nav>
```

- [ ] **Step 5: Restyle**

In `src/style.css`, replace the `.work-bio`, `.work-bio::first-line` and `.work-socials` rules under `/* ---------- about ---------- */` with:

```css
/* ---------- about ---------- */
.about-grid {
  display: grid;
  /* The credo is a fixed-ish column and the bio takes the rest: a 1fr 1fr
     split let a three-word line claim half the station. */
  grid-template-columns: minmax(0, 15rem) minmax(0, 1fr);
  gap: 2.5rem;
  align-items: start;
  width: 100%;
}
.about-credo {
  font-family: var(--serif);
  font-style: italic;
  font-size: clamp(1.5rem, 3.2vw, 2.1rem);
  line-height: 1.25;
  color: rgba(216, 211, 200, 0.92);
  text-wrap: balance;
  /* Nudged onto the bio's first baseline rather than its box top, so the two
     columns start on the same line instead of merely at the same height. */
  padding-top: 0.15em;
}
.work-bio {
  /* Left-aligned, and measured. Centred at 32rem this had a ragged left edge
     on every line, which is the edge the eye returns to on each wrap. */
  max-width: 38rem;
  font-family: var(--serif);
  font-size: 1.02rem;
  line-height: 1.75;
  color: rgba(216, 211, 200, 0.78);
  text-align: left;
}
/* A lead line, without needing a second element to keep in sync with the bio
   string in portfolio.js. */
.work-bio::first-line { color: rgba(216, 211, 200, 0.95); }

.work-socials {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
  justify-content: center;
}
.work-socials a {
  color: rgba(216, 211, 200, 0.6);
  font-family: var(--mono);
  font-size: 0.68rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  text-decoration: none;
  border-bottom: 1px solid transparent;
  /* Touch target, not just text. */
  padding: 0.5rem 0.2rem;
  transition: color 0.25s, border-color 0.25s;
}
.work-socials a:hover { color: var(--bone); border-bottom-color: rgba(193, 23, 15, 0.6); }

@media (max-width: 720px) {
  /* Two columns need two columns' worth of width. Below this the credo sits
     above the bio as a lead line, which is what it is. */
  .about-grid { grid-template-columns: 1fr; gap: 1.4rem; }
  .about-credo { padding-top: 0; }
}
```

Then make the contact block the destination it is. Replace the `.contact` display rule and `.contact-mail`:

```css
/* Custom work is the actual business ask on this page, so the address is a
   destination rather than a footnote in a sentence — framed with the same red
   hairline the altar uses, so it reads as part of the same object. */
.contact {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  padding: 1.4rem 2rem;
  border: 1px solid rgba(193, 23, 15, 0.4);
  background: rgba(5, 2, 1, 0.4);
  box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.6);
}
.contact-mail {
  font-family: var(--serif);
  font-style: italic;
  font-size: clamp(1.2rem, 2.6vw, 1.55rem);
  color: rgba(216, 211, 200, 0.92);
  text-decoration: none;
  border-bottom: 1px solid rgba(193, 23, 15, 0.5);
  padding-bottom: 3px;
  transition: color 0.25s, border-color 0.25s;
}
.contact-mail:hover { color: #fff; border-bottom-color: var(--blood); }
```

- [ ] **Step 6: Run the tests**

Run: `npm test -- portfolio`
Expected: PASS.

Run: `npm test && npm run test:e2e -- --grep layout`
Expected: PASS at all six viewports. The about station is wider now; if 375px fails on `station 2 overflows itself`, the cause is `.about-grid`'s `minmax(0, 15rem)` not collapsing — confirm the 720px media query is present and not overridden by a later rule.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(about): asymmetric layout, the credo stated, the ask last

Three centred blocks of equal weight gave nothing to lead with, and the
positioning line lived only in the title and the JSON-LD where no visitor
could read it. The credo now leads, the bio is left-aligned and measured,
and the socials sit below the email so the last thing before the footer is
the business rather than an exit link.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: The beats station — featured ledger, framed embed, honest sound

The embed stays; everything around it changes. Plus: release the ambience when someone engages the player.

**Files:**
- Modify: `src/content/portfolio.js` (add `FEATURED`, `formatBeatMeta`, `beatLink`)
- Modify: `src/audio.js` (add `playerEngaged`)
- Modify: `index.html` (`#station-beats` subtree)
- Modify: `src/main.js` (`featuredRow`, `fillStaticPortfolio`, the engagement listener)
- Modify: `src/style.css` (featured ledger + altar frame)
- Test: `tests/portfolio.test.js`, `tests/audio.test.js`

**Interfaces:**
- Consumes: `#station-beats` from Task 3; the existing `.work-list` ledger typography
- Produces:
  - `FEATURED: Array<{title, bpm, key, mood, url}>`
  - `formatBeatMeta(beat) => string`
  - `beatLink(beat) => string | null`
  - `playerEngaged(activeElement, frame) => boolean`

- [ ] **Step 1: Write the failing tests**

Append to `tests/portfolio.test.js`:

```js
import { FEATURED, formatBeatMeta, beatLink } from '../src/content/portfolio.js';

describe('featured beats', () => {
  it('is a short, curated set — not the whole catalog', () => {
    // The embed below it is the catalog. This is the menu, and a menu that
    // scrolls is a list.
    expect(FEATURED.length).toBeGreaterThanOrEqual(3);
    expect(FEATURED.length).toBeLessThanOrEqual(8);
  });

  it('every beat has a title and a tempo', () => {
    for (const b of FEATURED) {
      expect(typeof b.title).toBe('string');
      expect(b.title.length).toBeGreaterThan(0);
      expect(Number.isFinite(b.bpm)).toBe(true);
    }
  });

  it('any beat that declares a url declares a usable one', () => {
    for (const b of FEATURED) {
      if (b.url === null || b.url === undefined) continue;
      expect(beatLink(b), `${b.title} has an unusable url`).not.toBeNull();
    }
  });
});

describe('formatBeatMeta', () => {
  it('reads as one line of mono metadata', () => {
    expect(formatBeatMeta({ bpm: 92, key: 'F minor' })).toBe('92 bpm · F minor');
  });

  it('drops a missing key rather than trailing a separator', () => {
    expect(formatBeatMeta({ bpm: 92 })).toBe('92 bpm');
    expect(formatBeatMeta({ bpm: 92, key: '   ' })).toBe('92 bpm');
  });

  it('never throws on a malformed beat', () => {
    expect(() => formatBeatMeta({})).not.toThrow();
    expect(() => formatBeatMeta(null)).not.toThrow();
    expect(formatBeatMeta(null)).toBe('');
  });
});

describe('beatLink', () => {
  it('returns a real beatstars beat url', () => {
    expect(beatLink({ url: 'https://www.beatstars.com/beat/nightshade-123' }))
      .toBe('https://www.beatstars.com/beat/nightshade-123');
  });

  it.each([
    ['missing', {}],
    ['null', { url: null }],
    ['a placeholder', { url: 'https://www.beatstars.com/beat/PLACEHOLDER' }],
    ['insecure', { url: 'http://www.beatstars.com/beat/abc' }],
    ['off-platform', { url: 'https://example.com/beat/abc' }],
    ['the store root, not a beat', { url: 'https://www.beatstars.com/prodfish' }],
  ])('returns null when the url is %s', (_label, beat) => {
    expect(beatLink(beat)).toBeNull();
  });
});
```

Append to `tests/audio.test.js`:

```js
import { playerEngaged } from '../src/audio.js';

// The BeatStars player is cross-origin, so there is no way to observe what it
// is doing. What IS observable: clicking into a cross-origin iframe blurs the
// parent window and makes that iframe document.activeElement. It is a
// heuristic — it fires on any click into the frame, not strictly on play — but
// it fails safe, and a visitor who has reached into the player is a visitor
// who wants to hear a beat and not crickets.
describe('playerEngaged', () => {
  const frame = { tag: 'iframe' };

  it('is true when focus has moved into the player', () => {
    expect(playerEngaged(frame, frame)).toBe(true);
  });

  it('is false when focus is anywhere else on the page', () => {
    expect(playerEngaged({ tag: 'button' }, frame)).toBe(false);
    expect(playerEngaged(null, frame)).toBe(false);
  });

  it('is false when there is no player at all', () => {
    // The no-JS and no-WebGL paths, and the unit tests, have no iframe.
    expect(playerEngaged(frame, null)).toBe(false);
    expect(playerEngaged(null, null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- portfolio audio`
Expected: FAIL — `FEATURED` and `playerEngaged` are not exported.

- [ ] **Step 3: Add the content and helpers**

In `src/content/portfolio.js`, after `CREDITS`/`creditLink`:

```js
// PLACEHOLDER — swap for the real featured beats.
//
// The menu, not the catalog: the BeatStars embed below this ledger is the
// catalog, and it is also the only thing on the page that plays audio. Nothing
// here streams anything. That is deliberate — audio that never touches this
// origin can never be published untagged by accident, and a tagged preview is
// what protects a beat anyway, not where it is hosted.
//
// `url` is a per-beat BeatStars page and is optional, exactly like `spotify`
// on a credit: a row without one renders as honestly inert text rather than a
// link to nowhere, so these can be filled in one at a time.
export const FEATURED = [
  { title: 'nightshade',     bpm: 92,  key: 'F minor',  mood: 'sparse · tape hiss',      url: null },
  { title: 'delta psalm',    bpm: 74,  key: 'C# minor', mood: 'organ · slow drums',      url: null },
  { title: 'kerosene choir', bpm: 140, key: 'G minor',  mood: 'halftime · bent guitar',  url: null },
  { title: 'low country',    bpm: 83,  key: 'A minor',  mood: 'dust · upright bass',     url: null },
  { title: 'revival tent',   bpm: 128, key: 'D minor',  mood: 'handclaps · room noise',  url: null },
];

// One line of mono under the title. Built rather than stored so a beat with no
// key yet does not render a dangling separator.
export function formatBeatMeta(beat) {
  const bits = [];
  if (Number.isFinite(beat?.bpm)) bits.push(`${beat.bpm} bpm`);
  if (typeof beat?.key === 'string' && beat.key.trim()) bits.push(beat.key.trim());
  return bits.join(' · ');
}

// The single place that decides whether a featured row is a link. As strict as
// creditLink(), and for the same reason: it must be an https beatstars.com
// /beat/ URL with an id after it, so a half-filled entry is treated as absent
// rather than shipped as a dead link.
export function beatLink(beat) {
  const url = beat?.url;
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (/placeholder/i.test(trimmed)) return null;
  return /^https:\/\/(www\.)?beatstars\.com\/beat\/[^/\s]+/i.test(trimmed) ? trimmed : null;
}
```

In `src/audio.js`, after `duckLevel`:

```js
// Whether the visitor has reached into the BeatStars player. The embed is
// cross-origin, so nothing about what it is playing is observable — but
// clicking into a cross-origin iframe blurs the parent window and makes that
// iframe document.activeElement, which is signal enough. Called from a window
// `blur` handler; see main.js.
export function playerEngaged(activeElement, frame) {
  return !!frame && activeElement === frame;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- portfolio audio`
Expected: PASS.

- [ ] **Step 5: Add the ledger markup**

In `index.html`, inside `#station-beats`, insert immediately after the `<h2>` and before `<div class="altar-frame">`:

```html
          <!-- The menu above the catalog. Pure typography, no audio: this is
               where someone decides they want to hear something, and the embed
               below is where they hear it. Rows are links only where a real
               per-beat URL exists — see featuredRow() in main.js. -->
          <ul class="beat-list"></ul>
```

And wrap the embed with a label, replacing the `<div class="altar-frame">` opening tag with:

```html
          <p class="altar-label">the whole catalog, playing</p>
          <div class="altar-frame">
```

- [ ] **Step 6: Render the rows**

In `src/main.js`, update the portfolio import:

```js
import { CREDITS, BIO, CATALOG_URL, SOCIALS, FEATURED, creditLink, beatLink, formatBeatMeta } from './content/portfolio.js';
```

Add `featuredRow` next to `creditRow`:

```js
// One row of the featured ledger: title on the left, tempo and key on the
// right, mood underneath. Deliberately the same two-column shape as a credit
// row — beats and credits are one ledger, one column for sale and one
// released — but with no Spotify mark, because these do not go to Spotify.
//
// The row is a link ONLY when beatLink() hands back a real BeatStars URL, for
// the same reason creditRow() works that way: a row styled as clickable that
// goes nowhere is worse than one that plainly is not a link yet.
function featuredRow(beat) {
  const li = document.createElement('li');
  const href = beatLink(beat);

  const title = document.createElement('span');
  title.className = 'work-track beat-title';
  title.textContent = beat.title;

  const meta = document.createElement('span');
  meta.className = 'work-artist beat-meta';
  meta.textContent = formatBeatMeta(beat);

  const mood = document.createElement('span');
  mood.className = 'beat-mood';
  mood.textContent = beat.mood ?? '';

  if (!href) {
    li.className = 'work-row work-row-plain beat-row';
    li.append(title, meta, mood);
    return li;
  }

  li.className = 'work-row beat-row';
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  a.setAttribute('aria-label', `${beat.title} — license on BeatStars (opens in a new tab)`);
  a.append(title, meta, mood);
  li.append(a);
  return li;
}
```

In `fillStaticPortfolio`, add the featured list. Change the guard and add the loop:

```js
function fillStaticPortfolio() {
  const list = document.querySelector('.work-list');
  const beats = document.querySelector('.beat-list');
  const bio = document.querySelector('.work-bio');
  const socialNav = document.querySelector('.work-socials');
  const catalog = document.querySelector('.work-catalog');
  if (!list || !bio || !socialNav || !catalog) return;
  for (const c of CREDITS) list.append(creditRow(c));
  // Optional: the noscript path hides the injected sections, and the beats
  // station must still work without JS via the embed alone.
  if (beats) for (const b of FEATURED) beats.append(featuredRow(b));
  bio.textContent = BIO;
  for (const s of SOCIALS) {
    const a = document.createElement('a');
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = s.label;
    socialNav.append(a);
  }
  catalog.href = CATALOG_URL;
}
```

- [ ] **Step 7: Release the ambience on engagement**

In `src/main.js`, update the audio import:

```js
import { createAmbience, duckLevel, playerEngaged } from './audio.js';
```

And add, immediately after the `soundBtn?.addEventListener('click', ...)` block near the bottom of the file:

```js
// Reaching into the player means wanting to hear a beat, and the swamp has no
// business underneath it. duckLevel() already pulls the ambience down to 15%
// on arrival by scroll position, but it cannot know when someone actually
// presses play inside a cross-origin frame — this can. Stops the ambience
// outright and flips the toggle, so the control never claims sound is on when
// the only thing audible belongs to BeatStars.
window.addEventListener('blur', () => {
  const frame = document.querySelector('.altar-frame iframe');
  if (!playerEngaged(document.activeElement, frame)) return;
  if (!ambience.running) return;
  ambience.stop();
  // Not `soundArmed = false`: this is not the visitor saying "off", it is the
  // page getting out of the way. The next deliberate press turns it back on.
  markSound(false);
});
```

- [ ] **Step 8: Style the ledger and the frame**

In `src/style.css`, after the `.work-row` rules, add:

```css
/* ---------- the featured ledger ---------- */
/* The same ledger as the credits, in three parts rather than two: title and
   metadata on one line, mood beneath. Beats and credits are one object — one
   column for sale, one released — so the typography is shared outright rather
   than imitated. */
.beat-list {
  list-style: none;
  width: 100%;
  max-width: 34rem;
  display: flex;
  flex-direction: column;
}
.beat-row > a,
.beat-row.work-row-plain {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas:
    'title meta'
    'mood  mood';
  align-items: baseline;
  gap: 0.2rem 1.2rem;
  padding: 0.85rem 0.3rem;
  text-decoration: none;
  transition: background 0.25s;
}
.beat-title { grid-area: title; justify-content: flex-start; text-align: left; }
.beat-meta { grid-area: meta; }
.beat-mood {
  grid-area: mood;
  font-family: var(--mono);
  font-size: 0.58rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(216, 211, 200, 0.55);
}
.beat-row > a:hover { background: linear-gradient(90deg, transparent, rgba(193, 23, 15, 0.12), transparent); }
.beat-row > a:hover .beat-title { color: #fff; }

/* The embed is a foreign design system dropped into the chapel, and a soft
   edge would read as a seam. A hard, deliberate frame makes it read as a
   screen set into stonework instead — an object on purpose. */
.altar-label {
  font-family: var(--mono);
  font-size: 0.6rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: rgba(216, 211, 200, 0.55);
  margin-top: 1rem;
}
```

Add `.beat-row > a:focus-visible,` to the shared focus block alongside `.work-list a:focus-visible`.

In the `@media (max-width: 520px)` block, add:

```css
  .beat-row > a,
  .beat-row.work-row-plain {
    grid-template-columns: 1fr;
    grid-template-areas: 'title' 'meta' 'mood';
    gap: 0.15rem;
    padding: 0.8rem 0.2rem;
  }
```

- [ ] **Step 9: Run everything**

Run: `npm test`
Expected: PASS.

Run: `npm run test:e2e`
Expected: PASS. Both player-fallback tests must still pass — the fallback markup and `watchPlayer()` are untouched, and `#station-beats .bs-link` still resolves.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(beats): a featured ledger above the embed, and honest sound

The site handed the peak of the journey to a cross-origin iframe rendering
someone else's design system. It now owns the browsing — a typographic menu
in the same ledger as the credits — and leaves BeatStars the catalog and the
transaction, which is where they belong. No audio touches this origin, so no
untagged file can be published from it by accident.

Also: reaching into the player now stops the swamp and flips the toggle.
duckLevel() ducks by scroll position and cannot see a cross-origin press.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Station reveals

One orchestrated reveal per station, behind `gsap.matchMedia()` so reduced motion gets none of it.

**Files:**
- Modify: `src/main.js` (add `wireStationMotion`, call from `boot()`)
- Modify: `index.html` (add `data-reveal` to the elements that stagger)

**Interfaces:**
- Consumes: `.station` from Task 3; `gsap` and `ScrollTrigger` already imported in `main.js`
- Produces: nothing consumed elsewhere

**Before starting:** load the `gsap-scrolltrigger` skill — this task uses `scrollTrigger` config inside a tween, and the trigger/start semantics matter.

- [ ] **Step 1: Mark what reveals**

In `index.html`, add `data-reveal` to each direct child of a station that should stagger in. On `#station-beats`: the `<h2>`, `<ul class="beat-list">`, `<p class="altar-label">`, `<div class="altar-frame">`, `<a class="bs-link">`. On `#station-work`: the `<h2>`, `<ul class="work-list">`, `<a class="work-catalog">`. On `#station-about`: the `<h2>`, `<div class="about-grid">`, `<p class="contact">`, `<nav class="work-socials">`.

Example:

```html
          <h2 class="station-title" id="title-work" data-reveal>
            <span class="station-num" aria-hidden="true">ii</span>the work
          </h2>
          <ul class="work-list" data-reveal></ul>
          <a class="bs-link work-catalog" target="_blank" rel="noopener" data-reveal>the full catalog &#8599;</a>
```

- [ ] **Step 2: Add the motion**

In `src/main.js`, add above `boot()`:

```js
// One reveal per station, and nothing else. The journey has already spent
// fifteen screens on motion; the destination's job is to be read, so this is a
// single short lift on arrival rather than a set of micro-interactions
// competing with the text.
//
// Behind matchMedia so `prefers-reduced-motion` gets no animation at all and
// GSAP reverts every tween it created — one mechanism, rather than a second
// one racing the .reduced class. autoAlpha, not opacity: an unrevealed row is
// visibility:hidden and cannot be clicked or tabbed into by accident.
function wireStationMotion() {
  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    for (const station of document.querySelectorAll('.station')) {
      const parts = station.querySelectorAll('[data-reveal]');
      if (!parts.length) continue;
      gsap.from(parts, {
        autoAlpha: 0,
        y: 14,
        duration: 0.7,
        ease: 'power2.out',
        stagger: { each: 0.06 },
        scrollTrigger: {
          trigger: station,
          // Not 'top top': the station would be fully framed before it moved.
          start: 'top 78%',
          once: true,
        },
      });
    }
  });
  return mm;
}
```

In `boot()`, immediately after the `ScrollTrigger.refresh()` added in Task 3:

```js
  wireStationMotion();
```

- [ ] **Step 3: Verify in a browser**

Run: `npm run dev`

Check, at a 1280×800 window:
1. Scroll to the chapel. Each station's parts lift in once, staggered, as it comes up.
2. Scroll back up and down again — the reveal does not replay (`once: true`).
3. The sticky nav marks the station you are on and jumps smoothly when clicked.
4. Nothing is invisible or unclickable after the reveal (a stuck `autoAlpha: 0` is the failure mode; check `.contact-mail` is clickable).

Then in the browser's rendering panel, force `prefers-reduced-motion: reduce`, reload, and confirm all three stations are fully visible and static with no reveal.

- [ ] **Step 4: Run everything**

Run: `npm test && npm run test:e2e`
Expected: PASS. The e2e suites use `reducedMotion: 'reduce'` for layout and `settled()` waits on `body.ready`, so the reveal must not gate any assertion.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(chapel): one staggered reveal per station

Behind gsap.matchMedia() so reduced motion gets no animation and GSAP
reverts what it created — one mechanism rather than a second racing the
.reduced class.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Verification checklist

Run after the final task, before calling this done:

- [ ] `npm test` — all unit suites pass
- [ ] `npm run test:e2e` — all Playwright suites pass at all six viewports
- [ ] `npm run build` — Vite build succeeds. **Read the full output.** A backtick inside a GLSL template literal has hung the preloader on this repo before; never trust a build whose output was suppressed.
- [ ] `git grep -n "panel"` in `src/` and `index.html` returns only unrelated hits (no `.panel-strip`, `.panel-dot`, `#panel-beats`)
- [ ] At 375×667: the page cannot be dragged sideways, all three stations fit, the sticky nav does not cover a heading
- [ ] The journey still ends where it did — the chapel fades in on arrival, not mid-walk. This is the regression Task 1 exists to prevent; check it by eye at 1280×800.
- [ ] `#skip` lands on the beats station, not the bottom of the document
- [ ] With JS disabled: the beats embed, the contact address and the nav anchors all work; credits and bio are hidden, not empty headings
