import { describe, it, expect } from 'vitest';
import { clamp01, candleIntensity, litCount, crowPhase, doorAngle } from '../src/world/events.js';

describe('candleIntensity', () => {
  it('all candles dark at 0, all fully lit at 1', () => {
    for (let i = 0; i < 12; i++) {
      expect(candleIntensity(0, i, 12)).toBe(0);
      expect(candleIntensity(1, i, 12)).toBe(1);
    }
  });
  it('candles ignite in aisle order', () => {
    const t = 0.4;
    for (let i = 1; i < 12; i++) {
      expect(candleIntensity(t, i, 12)).toBeLessThanOrEqual(candleIntensity(t, i - 1, 12));
    }
  });
  it('ignition is gradual (some candle mid-fade at t=0.5)', () => {
    const vals = Array.from({ length: 12 }, (_, i) => candleIntensity(0.5, i, 12));
    expect(vals.some((v) => v > 0 && v < 1)).toBe(true);
  });
});

describe('litCount', () => {
  it('counts partially and fully lit candles', () => {
    expect(litCount(0, 12)).toBe(0);
    expect(litCount(1, 12)).toBe(12);
    const mid = litCount(0.5, 12);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(12);
  });
});

describe('crowPhase', () => {
  it('all perched at 0, all gone at 1', () => {
    for (let i = 0; i < 5; i++) {
      expect(crowPhase(0, i)).toBe(0);
      expect(crowPhase(1, i)).toBe(1);
    }
  });
  it('takeoff is staggered: earlier crows lead', () => {
    expect(crowPhase(0.2, 0)).toBeGreaterThan(crowPhase(0.2, 3));
  });
});

describe('doorAngle', () => {
  it('closed at 0, opens inward past 90 degrees at 1, clamped', () => {
    expect(doorAngle(0)).toBe(0);
    // POSITIVE: the leaf must swing into the nave. Opening the other way
    // drove it through the portal's stepped jamb and its pilaster.
    expect(doorAngle(1)).toBeGreaterThan(Math.PI / 2);
    expect(doorAngle(2)).toBe(doorAngle(1));
  });
});
