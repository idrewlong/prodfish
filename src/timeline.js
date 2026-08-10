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
      scrub: 1.2,
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
  const DOOR_IN_T = Math.min(T_DOOR + 0.05, 0.9); // just inside the nave

  // ACT 1 — ARRIVAL: world emerges out of black; barely any motion yet.
  tl.to(state, { pathT: 0.08, duration: arrivalEnd }, 0)
    .to(state, { fireflies: 1, duration: arrivalEnd * 0.8 }, 0.01)
    .to('#blackout', { opacity: 0, duration: arrivalEnd * 0.8 }, 0.01)
    .to('#hero', { opacity: 0, y: -70, duration: 0.08 }, arrivalEnd - 0.03);

  // ACT 2 — APPROACH: the long walk; fog thickens; crows scatter mid-way.
  tl.to(state, { pathT: DOOR_FRONT_T, duration: approachEnd - approachStart, ease: 'power1.inOut' }, approachStart)
    .to(state, { fog: 0.04, duration: approachEnd - approachStart }, approachStart)
    .to(state, { swayAmp: 0.5, duration: approachEnd - approachStart }, approachStart)
    .to(state, { crowT: 1, duration: 0.14 }, 0.28);

  // ACT 3 — THRESHOLD: door swings open, red glow spills, we step through.
  tl.to(state, { doorT: 1, duration: 0.1, ease: 'power2.inOut' }, thresholdStart)
    .to('#glow', { opacity: 0.85, duration: 0.08 }, thresholdStart + 0.02)
    .to('#glow', { opacity: 0, duration: 0.06 }, thresholdEnd - 0.06)
    .to(state, { pathT: DOOR_IN_T, duration: thresholdEnd - thresholdStart, ease: 'power1.in' }, thresholdStart)
    .to(state, { fireflies: 0, duration: 0.08 }, thresholdStart + 0.04)
    .to(state, { fog: 0.028, duration: 0.08 }, thresholdEnd - 0.08);

  // ACT 4 — CHAPEL: down the aisle; candles ignite; the cross hums on.
  tl.to(state, { pathT: 0.97, duration: chapelEnd - chapelStart, ease: 'power1.out' }, chapelStart)
    .to(state, { candleT: 1, duration: (chapelEnd - chapelStart) * 0.9 }, chapelStart + 0.02)
    .to(state, { crossGlow: 1, duration: 0.1 }, chapelStart)
    .to(state, { swayAmp: 0.3, duration: 0.1 }, chapelStart);

  // ACT 5 — BEATS: settle before the altar; residual drift only.
  tl.to(state, { pathT: 1, duration: 1 - chapelEnd }, chapelEnd);

  return tl;
}
