import { describe, it, expect } from 'vitest';
import { deviceTier, TIERS } from '../src/device.js';

describe('deviceTier', () => {
  it('classifies mobile UA as low', () => {
    expect(deviceTier({ isMobileUA: true, memory: 8, cores: 8 })).toBe('low');
  });
  it('classifies low memory as low', () => {
    expect(deviceTier({ isMobileUA: false, memory: 4, cores: 8 })).toBe('low');
  });
  it('classifies few cores as low', () => {
    expect(deviceTier({ isMobileUA: false, memory: 16, cores: 4 })).toBe('low');
  });
  it('classifies desktop as high', () => {
    expect(deviceTier({ isMobileUA: false, memory: 16, cores: 10 })).toBe('high');
  });
  it('treats missing memory/cores as high signals absent (not low)', () => {
    expect(deviceTier({ isMobileUA: false })).toBe('high');
  });
});

describe('TIERS', () => {
  it('has settings for both tiers', () => {
    for (const t of ['low', 'high']) {
      expect(TIERS[t].particles).toBeGreaterThan(0);
      expect(TIERS[t].dprCap).toBeGreaterThan(0);
      expect(TIERS[t].candleLights).toBeGreaterThan(0);
      expect(TIERS[t].crows).toBeGreaterThan(0);
    }
  });
  it('low tier is lighter than high tier', () => {
    expect(TIERS.low.particles).toBeLessThan(TIERS.high.particles);
    expect(TIERS.low.candleLights).toBeLessThan(TIERS.high.candleLights);
    expect(TIERS.low.crows).toBeLessThanOrEqual(TIERS.high.crows);
  });
});
