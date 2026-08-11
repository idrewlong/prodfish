import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ACTS } from './choreography.js';
import { tNearest, FORK, LANDMARKS, T_FORK_SCROLL } from './world/path.js';

export function buildTimeline(state, route = 'direct') {
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

  // Landmark parameters differ per route (the scenic route is longer, so the
  // door sits at a different fraction of it), so they are resolved per build
  // rather than imported as constants.
  const doorT = tNearest(LANDMARKS.DOOR, route);
  const forkT = tNearest(FORK, route);
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

  // ACT 2 — APPROACH: the long walk; fog thickens; crows scatter mid-way.
  // The approach is split at the signpost. Both routes reach the fork at the
  // SAME scroll fraction (T_FORK_SCROLL) even though forkT differs between
  // them — that is what lets a route switch preserve the camera's position
  // and the reader's scroll position at the same time.
  tl.to(state, { pathT: forkT, duration: T_FORK_SCROLL - approachStart, ease: 'sine.inOut' }, approachStart)
    .to(state, { pathT: APPROACH_END_T, duration: approachEnd - T_FORK_SCROLL, ease: 'sine.inOut' }, T_FORK_SCROLL)
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
    .to(state, { candleT: 1, duration: (chapelEnd - chapelStart) * 0.9 }, chapelStart + 0.02)
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
  tl.to('#chapel', { opacity: 1, duration: (1 - chapelEnd) * 0.55, ease: 'sine.in' }, chapelEnd);

  return tl;
}
