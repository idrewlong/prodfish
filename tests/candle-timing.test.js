import { describe, it, expect } from 'vitest';
import { ACTS } from '../src/choreography.js';
import { CANDLE_IGNITE_START, CANDLE_IGNITE_DURATION } from '../src/timeline.js';
import { candleIntensity } from '../src/world/events.js';
import { TOTAL, CANDLE_Z0, CANDLE_Z_SPAN } from '../src/world/candles.js';
import { tNearest, LANDMARKS, positionAt } from '../src/world/path.js';

// Bug: candles in the chapel were lighting AFTER the camera had already
// walked past them, not before -- a visitor scrolling forward never saw a
// candle catch, only noticed it (faintly) while scrolling back. The fix
// moved the ignition window's scroll position; these tests assert the
// property that actually matters -- that the camera has NOT reached a
// candle yet when that candle starts glowing -- rather than re-asserting
// specific scroll numbers, which is what let the original bug ship (the
// window "looked" plausible on paper against the wrong doorway-crossing
// estimate).

const [thresholdActStart, thresholdActEnd] = ACTS.threshold;
const [chapelActStart] = ACTS.chapel;

// Mirrors timeline.js's own pathT(scroll) mapping for the threshold and
// chapel acts ONLY (the two acts the candle window can fall in) -- these
// are the exact tween shapes buildTimeline() constructs (threshold: linear
// 'none' ease from APPROACH_END_T to DOOR_IN_T; chapel: 'sine.out' ease up
// to pathT=1). If those tweens' easing or endpoints change in timeline.js,
// this needs to change with them, or this test silently stops meaning
// anything -- it is intentionally NOT imported from timeline.js because
// buildTimeline() only exposes a live GSAP timeline tied to the DOM/
// ScrollTrigger, not a pure scroll->pathT function to call directly.
const doorT = tNearest(LANDMARKS.DOOR, 'direct');
const APPROACH_END_T = doorT - 0.07 - 0.02;
const DOOR_IN_T = Math.min(doorT + 0.05, 0.9);
const sineOut = (t) => Math.sin((t * Math.PI) / 2);

function pathTAtScroll(s) {
  if (s <= thresholdActEnd) {
    const frac = (s - thresholdActStart) / (thresholdActEnd - thresholdActStart);
    return APPROACH_END_T + (DOOR_IN_T - APPROACH_END_T) * Math.min(1, Math.max(0, frac));
  }
  const frac = (s - chapelActStart) / (1 - chapelActStart);
  return DOOR_IN_T + (1 - DOOR_IN_T) * sineOut(Math.min(1, Math.max(0, frac)));
}

function cameraZAtScroll(s) {
  return positionAt(pathTAtScroll(s), 'direct').z;
}

// Scroll fraction at which candle i's flame first starts fading in
// (candleIntensity crosses above 0), found by bisecting the REAL exported
// candleT->intensity function against the REAL ignition window -- no
// internal candleIntensity formula (start/width) is duplicated here.
function scrollWhereCandleStartsFading(i) {
  let lo = CANDLE_IGNITE_START;
  let hi = CANDLE_IGNITE_START + CANDLE_IGNITE_DURATION;
  for (let iter = 0; iter < 60; iter++) {
    const mid = (lo + hi) / 2;
    const candleT = (mid - CANDLE_IGNITE_START) / CANDLE_IGNITE_DURATION;
    if (candleIntensity(candleT, i, TOTAL) > 0) hi = mid; else lo = mid;
  }
  return hi;
}

function candleZ(i) {
  return CANDLE_Z0 - (i / TOTAL) * CANDLE_Z_SPAN;
}

describe('candle ignition timing', () => {
  it('window is well-formed: starts before it ends, and finishes before the journey does', () => {
    expect(CANDLE_IGNITE_DURATION).toBeGreaterThan(0);
    expect(CANDLE_IGNITE_START + CANDLE_IGNITE_DURATION).toBeLessThan(1.0);
  });

  it('the doorway is already open by the time candles can ignite (not visible through a closed facade)', () => {
    // doorT tween: thresholdStart + 0.1 duration, see timeline.js ACT 3.
    // If CANDLE_IGNITE_START fell before the door finishes swinging open,
    // any glow would genuinely be hidden behind a shut door.
    const doorFullyOpenScroll = thresholdActStart + 0.1;
    expect(CANDLE_IGNITE_START).toBeGreaterThanOrEqual(doorFullyOpenScroll);
  });

  // THE regression test: for every candle, the camera must NOT have reached
  // that candle's position yet at the scroll fraction where it starts
  // fading in. This is the exact property the original bug violated -- with
  // the old window (chapelStart + 0.02 = 0.64, duration 0.18), candles 0-4
  // (the ones nearest the door, the first a visitor would pass) had a
  // NEGATIVE lead of up to -0.9m: candleT hadn't even begun moving off zero
  // until the camera was already 0.9m past them.
  it('every candle starts fading in while the camera still has meaningful lead distance to it', () => {
    const leads = [];
    for (let i = 0; i < TOTAL; i++) {
      const s = scrollWhereCandleStartsFading(i);
      const camZ = cameraZAtScroll(s);
      const lead = camZ - candleZ(i); // positive = camera hasn't arrived yet
      leads.push(lead);
      expect(lead, `candle ${i} lead distance`).toBeGreaterThan(1.0);
    }
    // Sanity: this isn't just barely passing -- confirms real headroom, and
    // would fail hard (most leads negative) against the old 0.64/0.18
    // window this replaced.
    expect(Math.min(...leads)).toBeGreaterThan(1.0);
  });

  it('candles ignite in aisle order relative to scroll (candle 0 before candle 13)', () => {
    expect(scrollWhereCandleStartsFading(0)).toBeLessThan(scrollWhereCandleStartsFading(TOTAL - 1));
  });
});
