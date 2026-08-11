import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ACTS } from './choreography.js';
import { T_DOOR } from './world/path.js';

export function buildTimeline(state) {
  gsap.registerPlugin(ScrollTrigger);

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '#scroll-track',
      start: 'top top',
      end: 'bottom bottom',
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

  // Path keyframes derive from the door's real arc-length position so the
  // camera reaches the doorway exactly at the threshold act, whatever the
  // curve's proportions are.
  const DOOR_FRONT_T = T_DOOR - 0.07; // a few meters shy of the door
  // fix-round: the approach act used to tween all the way to DOOR_FRONT_T
  // itself, which meant its sine.inOut deceleration had to fully complete
  // right at the door -- combined with the threshold act's old power1.in
  // (accelerating) pathT ease picking up immediately after, the camera
  // read as slow-then-sudden-fast right at the doorway, the exact "speeds
  // up and enters too fast" complaint. Stopping a small margin short hands
  // the final approach to the door over to the threshold act's own slow,
  // even crawl instead.
  const APPROACH_END_T = DOOR_FRONT_T - 0.02;
  const DOOR_IN_T = Math.min(T_DOOR + 0.05, 0.9); // just inside the nave

  // ACT 1 — ARRIVAL: world emerges out of black; barely any motion yet.
  // fix-round: #blackout now starts at 0.55 opacity (style.css), not 1 --
  // the scene should be faintly visible at rest, behind the title, instead
  // of a pure black void. fromTo (not to) so the tween's start value is
  // explicit and can never drift out of sync with the CSS default.
  tl.to(state, { pathT: 0.08, duration: arrivalEnd }, 0)
    .to(state, { fireflies: 1, duration: arrivalEnd * 0.8 }, 0.01)
    .fromTo('#blackout', { opacity: 0.55 }, { opacity: 0, duration: arrivalEnd * 0.8 }, 0.01)
    .to('#hero', { opacity: 0, y: -70, duration: 0.08 }, arrivalEnd - 0.03);

  // ACT 2 — APPROACH: the long walk; fog thickens; crows scatter mid-way.
  // fix-round: previously split into a slow tree-corridor tween (first 65%
  // of this act's scroll) followed by a `power2.in`-eased sprint for the
  // final 35% -- power2.in is slow-start-fast-end, and because that segment
  // was ALSO squeezed into a small slice of scroll, its fast end produced a
  // violent camera lurch right at the church (confirmed via screenshots:
  // 40% scroll shows the church small and distant, 45% shows the camera
  // point-blank at the door -- a whiplash jump, not a walk). A single gentle
  // `sine.inOut` tween across the whole act reads as one steady, unhurried
  // approach with no ramp: slow-in, even through the middle, slow-out
  // toward the door. It now lands on APPROACH_END_T (a hair short of
  // DOOR_FRONT_T) at approachEnd, leaving the last stretch to the
  // threshold act's linear crawl -- see APPROACH_END_T comment above.
  tl.to(state, { pathT: APPROACH_END_T, duration: approachEnd - approachStart, ease: 'sine.inOut' }, approachStart)
    .to(state, { fog: 0.04, duration: approachEnd - approachStart }, approachStart)
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
  tl.to(state, { pathT: 0.97, duration: chapelEnd - chapelStart, ease: 'power1.out' }, chapelStart)
    .to(state, { candleT: 1, duration: (chapelEnd - chapelStart) * 0.9 }, chapelStart + 0.02)
    .to(state, { swayAmp: 0.3, duration: 0.1 }, chapelStart);

  // ACT 5 — BEATS: settle before the altar; residual drift only.
  // fix-round: #chapel (the BeatStars embed DOM section) is an in-flow block
  // at the bottom of the scroll-track, so it was already sliding into
  // the viewport well before this act even starts, while the
  // camera was still mid-drift down the aisle in ACT 4. That mismatch read
  // as a jarring scene change. #chapel now starts at opacity 0 (style.css)
  // and fades in here, driven by the same scroll fraction as the camera
  // settle, so it only becomes visible once pathT has essentially arrived.
  tl.to(state, { pathT: 1, duration: 1 - chapelEnd }, chapelEnd)
    .to('#chapel', { opacity: 1, duration: (1 - chapelEnd) * 0.55, ease: 'sine.in' }, chapelEnd);

  return tl;
}
