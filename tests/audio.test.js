import { describe, it, expect } from 'vitest';
import { crickChance, duckLevel, mixGain } from '../src/audio.js';

describe('crickChance', () => {
  it('never goes negative or exceeds the base rate', () => {
    for (let t = 0; t < 200; t += 0.7) {
      const r = crickChance(t, 9);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(9);
    }
  });
  it('swells and fades rather than holding one rate', () => {
    // A field of crickets goes quiet and picks up again; a constant rate
    // reads as a machine.
    const xs = [];
    for (let t = 0; t < 80; t += 1) xs.push(crickChance(t, 9));
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(1);
  });
});

describe('duckLevel', () => {
  it('is full volume for the whole journey', () => {
    expect(duckLevel(0)).toBe(1);
    expect(duckLevel(0.5)).toBe(1);
    expect(duckLevel(0.8)).toBe(1);
  });
  it('drops hard once the beats are reached', () => {
    // Crickets over a track is the fastest way to make someone hit mute.
    expect(duckLevel(0.92)).toBeLessThan(0.2);
    expect(duckLevel(1)).toBeLessThan(0.2);
  });
  it('fades down rather than cutting', () => {
    const a = duckLevel(0.84);
    const b = duckLevel(0.88);
    expect(a).toBeLessThan(1);
    expect(b).toBeLessThan(a);
  });
  it('never goes negative', () => {
    for (let p = 0; p <= 1; p += 0.02) expect(duckLevel(p)).toBeGreaterThanOrEqual(0);
  });
});

describe('mixGain', () => {
  it('combines the visitor’s level with the scroll duck', () => {
    expect(mixGain(1, 1, 1)).toBe(1);
    expect(mixGain(0.5, 1, 1)).toBe(0.5);
    expect(mixGain(1, 0.15, 1)).toBeCloseTo(0.15, 5);
  });
  it('lets the duck still apply at full user volume', () => {
    // Turning it up during the beats must not defeat the duck.
    expect(mixGain(1, duckLevel(1), 1)).toBeLessThan(mixGain(1, duckLevel(0), 1));
  });
  it('clamps nonsense input instead of blowing out the gain', () => {
    expect(mixGain(5, 5, 1)).toBe(1);
    expect(mixGain(-3, 1, 1)).toBe(0);
  });
});
