import { describe, it, expect } from 'vitest';
import { flashIntensity, thunderDelay } from '../src/world/weather.js';

describe('flashIntensity', () => {
  it('is dark outside the strike', () => {
    expect(flashIntensity(-1)).toBe(0);
    expect(flashIntensity(5)).toBe(0);
  });
  it('is brightest at the moment of the strike', () => {
    const at0 = flashIntensity(0.01);
    expect(at0).toBeGreaterThan(flashIntensity(0.3));
    expect(at0).toBeGreaterThan(0);
  });
  it('flickers rather than fading smoothly, like a real distant strike', () => {
    // Sample the burst; a smooth decay would be monotonic, a flicker is not.
    const xs = [];
    for (let t = 0; t < 0.6; t += 0.01) xs.push(flashIntensity(t));
    const rises = xs.filter((v, i) => i > 0 && v > xs[i - 1]).length;
    expect(rises).toBeGreaterThan(2);
  });
  it('never goes negative', () => {
    for (let t = 0; t < 1; t += 0.005) expect(flashIntensity(t)).toBeGreaterThanOrEqual(0);
  });
});

describe('thunderDelay', () => {
  it('lags the flash by the time sound needs to cross the distance', () => {
    expect(thunderDelay(343)).toBeCloseTo(1, 5);
    expect(thunderDelay(2600)).toBeGreaterThan(7);
  });
});
