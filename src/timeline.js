import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ACTS } from './choreography.js';
import { tNearest, LANDMARKS } from './world/path.js';
import { journeyDistancePx } from './journey.js';

// Candle ignition window (scroll fraction the candleT tween below runs
// over). candleIntensity() in world/events.js turns candleT into a
// per-candle fade using `start_i = (i/TOTAL)*0.85`, so candle i visibly
// starts catching light at scroll `CANDLE_IGNITE_START + start_i *
// CANDLE_IGNITE_DURATION`.
//
// MEASURED against the live scene (window.__camera.position.z read back at
// scroll fractions via a headless driver, cross-checked by replaying this
// exact tween chain offline against positionAt() from world/path.js -- the
// two agreed to within 0.001 scroll):
//   - the camera crosses the doorway plane (z=0) at scroll ~0.559, not the
//     ~0.75 an earlier hand-derivation assumed. That earlier number drove a
//     "fix" (ignition window 0.747-0.851) that was never implemented, which
//     is lucky: at scroll 0.747 the camera's real z is already ~-6.7 --
//     candle 0 (z=-2.6) would have been passed by ~4m before its wave even
//     reached it, reproducing the same bug it was meant to fix.
//   - the OLD window here (chapelStart + 0.02 = 0.64, duration
//     (chapelEnd-chapelStart)*0.9 = 0.18 -> runs 0.64..0.82) was likewise
//     never "outside, behind the facade" -- the camera is already 3m past
//     the door (z=-3.19) by scroll 0.64. The real defect: it gave the first
//     five candles (z=-2.6..-4.71, nearest the door -- exactly what a
//     visitor notices first) a NEGATIVE lead of up to -0.9m, i.e. candleT
//     didn't even start moving off zero until the camera had already
//     walked past them. That matches the report exactly: candles only
//     caught faintly on a slow reverse-scroll, because forward-scrolling
//     visitors never saw them catch.
//   - this window instead starts candle 0 right after the camera crosses
//     the (by-then fully open, see doorT tween below) doorway, giving every
//     candle 1.8-2.5m of lead before the camera reaches it. Fit by
//     bisecting each candle's target scroll against the real curve, then
//     solving START/DURATION to hit candle 0's and candle 13's targets
//     exactly (candleIntensity's schedule is linear in i, so the fit can't
//     hit all 14 exactly) -- max deviation from the in-between candles'
//     individual targets is ~0.02 scroll (~7.9% of the window), still
//     leaving every candle's lead comfortably positive (see
//     tests/candle-timing.test.js).
//
// Do not "tidy" these back toward the chapel act boundary (0.62) or later
// without re-measuring camera z against candle z first -- both of the
// window's previous positions looked more "principled" on paper and both
// reintroduced the reported bug.
export const CANDLE_IGNITE_START = 0.561;
export const CANDLE_IGNITE_DURATION = 0.248;

export function buildTimeline(state) {
  gsap.registerPlugin(ScrollTrigger);

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '#scroll-track',
      start: 'top top',
      // Pinned to the full journey's distance, NOT to the element's height.
      // The document is deliberately short before a road is chosen, and
      // `bottom bottom` would squeeze the entire timeline -- church, altar
      // and embed -- into those few screens. A fixed distance instead means
      // a short document simply runs out partway, parking the camera at the
      // fork. Function form so it re-measures on refresh/resize.
      end: () => `+=${journeyDistancePx(window.innerHeight)}`,
      // fix-round: 1.2 -> 2 -- extra scrub lag smooths out residual scroll
      // jitter now that the approach pathT tween below is a single gentle
      // ease instead of two tweens with an accelerating tail.
      scrub: 2,
    },
  });

  const [, arrivalEnd] = ACTS.arrival;
  const [approachStart, approachEnd] = ACTS.approach;
  const [thresholdStart, thresholdEnd] = ACTS.threshold;
  const [chapelStart, chapelEnd] = ACTS.chapel;

  const doorT = tNearest(LANDMARKS.DOOR);
  const DOOR_FRONT_T = doorT - 0.07;
  const APPROACH_END_T = DOOR_FRONT_T - 0.02;
  const DOOR_IN_T = Math.min(doorT + 0.05, 0.9);

  // ACT 1 — ARRIVAL: world emerges out of black; barely any motion yet.
  // fix-round: #blackout now starts at 0.55 opacity (style.css), not 1 --
  // the scene should be faintly visible at rest, behind the title, instead
  // of a pure black void. fromTo (not to) so the tween's start value is
  // explicit and can never drift out of sync with the CSS default.
  tl.to(state, { pathT: 0.08, duration: arrivalEnd }, 0)
    .to(state, { fireflies: 1, duration: arrivalEnd * 0.8 }, 0.01)
    .fromTo('#blackout', { opacity: 0.55 }, { opacity: 0, duration: arrivalEnd * 0.8 }, 0.01)
    .to('#hero', { opacity: 0, y: -70, duration: 0.08 }, arrivalEnd - 0.03);

  // ACT 2 — APPROACH: one steady, unhurried walk to the church door. A
  // single gentle ease, no split and no ramp: earlier versions accelerated
  // into the doorway and read as a lurch.
  tl.to(state, { pathT: APPROACH_END_T, duration: approachEnd - approachStart, ease: 'sine.inOut' }, approachStart);

  tl.to(state, { fog: 0.03, duration: approachEnd - approachStart }, approachStart)
    .to(state, { swayAmp: 0.5, duration: approachEnd - approachStart }, approachStart)
    .to(state, { crowT: 1, duration: 0.14 }, 0.28);

  // ACT 3 — THRESHOLD: door swings open, red glow spills, we step through.
  // crossGlow ramps here (was ACT 4, well after entry) so the neon cross is
  // already lit and visible through the opening doorway as the door swings,
  // instead of popping in after the camera has already crossed the plane —
  // starts alongside doorT and spans the whole act.
  tl.to(state, { doorT: 1, duration: 0.1, ease: 'power2.inOut' }, thresholdStart)
    .to(state, { crossGlow: 1, duration: thresholdEnd - thresholdStart, ease: 'power1.in' }, thresholdStart)
    .to('#glow', { opacity: 0.85, duration: 0.08 }, thresholdStart + 0.02)
    .to('#glow', { opacity: 0, duration: 0.06 }, thresholdEnd - 0.06)
    // fix-round: was `power1.in` -- an ACCELERATING ease, the literal
    // opposite of what a doorway crossing should feel like, and the main
    // cause of the "speeds up and enters too fast" complaint. `none`
    // (linear) gives a slow, even crawl through the doorway at a constant
    // pace instead of ramping up right as the camera passes the threshold.
    .to(state, { pathT: DOOR_IN_T, duration: thresholdEnd - thresholdStart, ease: 'none' }, thresholdStart)
    .to(state, { fireflies: 0, duration: 0.08 }, thresholdStart + 0.04)
    .to(state, { fog: 0.028, duration: 0.08 }, thresholdEnd - 0.08);

  // ACT 4 — CHAPEL: down the aisle; candles ignite; the cross is already lit
  // (see ACT 3 above) by the time we're inside.
  // fix-round: pathT used to be two separate tweens split at the
  // chapel/beats act boundary -- chapel eased 'power1.out' down to 0.97
  // (decelerating to ~zero velocity right at the seam), then beats picked
  // up at chapelEnd with the timeline's default 'none' (constant) ease.
  // Velocity jumping from ~0 to a nonzero constant exactly at the act
  // boundary read as the camera "switching position" -- the same class of
  // discontinuity as the old targetAt() step function (see path.js). A
  // single tween spanning both acts' full span removes the seam: one
  // continuous decelerating push all the way to the altar stop.
  tl.to(state, { pathT: 1, duration: 1 - chapelStart, ease: 'sine.out' }, chapelStart)
    // CANDLE_IGNITE_START (0.561) is a GSAP absolute position, not "+=" off
    // chapelStart -- it deliberately falls inside the THRESHOLD act's own
    // range (0.45-0.62), not this one, because that's where the camera
    // actually is relative to the candles (see the constant's comment
    // above). Declared here anyway, next to pathT, since it's the chapel's
    // effect even though it starts a beat early.
    .to(state, { candleT: 1, duration: CANDLE_IGNITE_DURATION }, CANDLE_IGNITE_START)
    .to(state, { swayAmp: 0.3, duration: 0.1 }, chapelStart);

  // ACT 5 — BEATS: settle before the altar; camera motion is the single
  // tween above (it spans this act too) -- this only drives the embed
  // fade-in, on the same scroll fraction as the settle.
  // fix-round: #chapel (the BeatStars embed DOM section) is an in-flow block
  // at the bottom of the scroll-track, so it was already sliding into
  // the viewport well before this act even starts, while the
  // camera was still mid-drift down the aisle in ACT 4. That mismatch read
  // as a jarring scene change. #chapel now starts at opacity 0 (style.css)
  // and fades in here, driven by the same scroll fraction as the camera
  // settle, so it only becomes visible once pathT has essentially arrived.
  // fromTo (not to), and pointerEvents alongside opacity: #chapel starts
  // `pointer-events: none` in CSS precisely so its invisible box (and live
  // iframe) cannot swallow clicks meant for the signpost while parked at the
  // fork -- see the CSS comment. Flipping it back to `auto` here, on the
  // same scrub as the fade-in, is what makes the embed clickable once it has
  // actually arrived.
  tl.fromTo('#chapel', { opacity: 0, pointerEvents: 'none' },
    { opacity: 1, pointerEvents: 'auto', duration: (1 - chapelEnd) * 0.55, ease: 'sine.in' }, chapelEnd);

  return tl;
}
