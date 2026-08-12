import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { crickChance, duckLevel, mixGain, createAmbience } from '../src/audio.js';

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

// Regression: `candle()` was once deleted from the ambience object while
// main.js still wired `onCandle: () => ambience.candle()`. The result was not
// a missing sound -- it was a dead scene. That callback ran inside
// candles.update(), which runs inside the render loop, so from the first
// candle catching (right at the doorway) every frame threw before reaching
// post.composer.render(): the journey visibly froze at the church door and
// never went inside.
//
// The candle cue has since been removed outright (it sounded like a light
// switch, not a wick), but the hazard it exposed is permanent: anything the
// page calls on the ambience must exist, because some of these fire from the
// render loop and nothing notices until a visitor scrolls to that exact spot.
describe('ambience surface', () => {
  const AMBIENCE_API = [
    'start', 'stop', 'setVolume', 'setDuck', 'thunder',
  ];

  it('exposes every method the page calls on it', () => {
    const amb = createAmbience();
    for (const name of AMBIENCE_API) {
      expect(typeof amb[name], `ambience.${name}`).toBe('function');
    }
  });

  it('has no caller reaching for a method it does not have', () => {
    // Cheap structural guard: whatever main.js calls on `ambience` must exist.
    // This is what would have caught the original deletion at test time
    // instead of at the doorway.
    const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
    const called = new Set([...main.matchAll(/\bambience\.(\w+)\s*\(/g)].map((m) => m[1]));
    expect(called.size).toBeGreaterThan(0);
    const amb = createAmbience();
    for (const name of called) {
      expect(typeof amb[name], `main.js calls ambience.${name}()`).toBe('function');
    }
  });

  it('is silent rather than throwing when a cue fires before sound is started', () => {
    // Cues are driven by the running scene, which does not wait for the
    // visitor to turn sound on. A throw here is a frozen scene, not a missing
    // sound effect.
    const amb = createAmbience();
    expect(amb.running).toBe(false);
    expect(() => amb.thunder()).not.toThrow();
  });
});

