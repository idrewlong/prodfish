import { describe, it, expect } from 'vitest';
import { loadFraction } from '../src/world/assets.js';
import { isTouchTablet } from '../src/device.js';
import {
  JOURNEY_VH, journeyDistancePx, journeyTrackPx, viewportBasis, resetViewportBasis,
} from '../src/journey.js';

describe('loadFraction', () => {
  it('is zero with nothing to load', () => {
    expect(loadFraction([])).toBe(0);
  });

  it('reports the byte fraction when every size is known', () => {
    expect(loadFraction([
      { loaded: 50, total: 100, done: false },
      { loaded: 100, total: 100, done: true },
    ])).toBe(0.75);
  });

  it('never exceeds 1 when a server over-reports', () => {
    expect(loadFraction([{ loaded: 500, total: 100, done: true }])).toBe(1);
  });

  it('falls back to counting files when no size is known', () => {
    // A host that omits Content-Length must still move the bar, not freeze it.
    expect(loadFraction([
      { loaded: 0, total: 0, done: true },
      { loaded: 0, total: 0, done: false },
    ])).toBe(0.5);
  });

  it('handles a mix of sized and unsized files', () => {
    const f = loadFraction([
      { loaded: 100, total: 100, done: true },
      { loaded: 0, total: 0, done: false },
    ]);
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThan(1);
  });

  it('reaches 1 only when everything has settled', () => {
    expect(loadFraction([
      { loaded: 100, total: 100, done: true },
      { loaded: 0, total: 0, done: true },
    ])).toBe(1);
  });
});

describe('isTouchTablet', () => {
  it('spots an iPad behind its desktop user agent', () => {
    // iPadOS Safari reports "Macintosh"; touch points are what give it away.
    expect(isTouchTablet({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.0 Safari/605.1.15',
      maxTouchPoints: 5,
    })).toBe(true);
  });

  it('leaves a real Mac alone', () => {
    expect(isTouchTablet({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
      maxTouchPoints: 0,
    })).toBe(false);
  });

  it('ignores a touchscreen Windows laptop', () => {
    expect(isTouchTablet({ userAgent: 'Mozilla/5.0 (Windows NT 10.0)', maxTouchPoints: 10 })).toBe(false);
  });

  it('survives being told nothing', () => {
    expect(isTouchTablet()).toBe(false);
  });
});

describe('journey sizing agrees with itself', () => {
  it('makes the track exactly one viewport longer than the scrub distance', () => {
    // The whole iOS bug was these two numbers being derived from different
    // units. Whatever basis they are given, they must stay one viewport apart.
    expect(journeyTrackPx(800) - journeyDistancePx(800)).toBeCloseTo(800, 6);
    expect(journeyTrackPx(640) - journeyDistancePx(640)).toBeCloseTo(640, 6);
  });

  it('sizes the track to the full journey', () => {
    expect(journeyTrackPx(800)).toBe((JOURNEY_VH / 100) * 800);
  });
});

describe('viewportBasis', () => {
  it('holds the first height it is given', () => {
    resetViewportBasis();
    expect(viewportBasis(800)).toBe(800);
    // iOS Safari's toolbar retracting reports a taller viewport mid-scroll.
    // Honouring that would re-scale the journey underneath the visitor.
    expect(viewportBasis(910)).toBe(800);
  });

  it('re-measures after an explicit reset, for a real rotation', () => {
    resetViewportBasis();
    viewportBasis(800);
    resetViewportBasis();
    expect(viewportBasis(430)).toBe(430);
  });
});
