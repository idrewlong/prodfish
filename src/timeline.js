import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ACTS } from './choreography.js';

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

  // ACT 1 — ARRIVAL: scene emerges out of black behind the title
  tl.to(state, { exteriorOpacity: 1, fireflies: 1, duration: arrivalEnd * 0.8 }, 0.01)
    .to('#blackout', { opacity: 0, duration: arrivalEnd * 0.8 }, 0.01)
    .to('#hero', { opacity: 0, y: -70, duration: 0.08 }, arrivalEnd - 0.03);

  // ACT 2 — APPROACH: dolly through the grass, fog thickens
  tl.to(state, { camZ: 3, duration: approachEnd - approachStart, ease: 'power1.in' }, approachStart)
    .to(state, { fog: 0.32, duration: approachEnd - approachStart }, approachStart)
    .to(state, { swayAmp: 0.45, duration: approachEnd - approachStart }, approachStart);

  // ACT 3 — THRESHOLD: red glow leaks, cut to door closeup, blackout
  tl.to('#glow', { opacity: 1, duration: 0.08 }, thresholdStart)
    .to(state, { thresholdOpacity: 1, duration: 0.06 }, thresholdStart + 0.03)
    .to(state, { exteriorOpacity: 0, fireflies: 0, duration: 0.05 }, thresholdStart + 0.05)
    .to(state, { camZ: -5, duration: thresholdEnd - thresholdStart, ease: 'power1.in' }, thresholdStart)
    .to('#blackout', { opacity: 1, duration: 0.05 }, thresholdEnd - 0.06)
    .to('#glow', { opacity: 0, duration: 0.04 }, thresholdEnd - 0.05)
    .to(state, { thresholdOpacity: 0, duration: 0.02 }, thresholdEnd - 0.02);

  // hard cut while black: teleport camera to the chapel
  tl.set(state, { camZ: -26, camY: 0.4, swayAmp: 0.3 }, thresholdEnd);

  // ACT 4 — CHAPEL: red interior fades in, drift down the aisle
  tl.to(state, { interiorOpacity: 1, duration: 0.07 }, chapelStart + 0.01)
    .to('#blackout', { opacity: 0, duration: 0.07 }, chapelStart + 0.01)
    .to(state, { camZ: -30, camY: 0, duration: chapelEnd - chapelStart, ease: 'power1.out' }, chapelStart);

  // ACT 5 — BEATS: chapel section scrolls into view (in-flow DOM);
  // keep a slow residual drift so the scene never fully freezes
  tl.to(state, { camZ: -30.8, duration: 1 - chapelEnd }, chapelEnd);

  return tl;
}
