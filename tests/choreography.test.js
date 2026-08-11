import { describe, it, expect } from 'vitest';
import { ACTS, createState } from '../src/choreography.js';

describe('ACTS', () => {
  const order = ['arrival', 'approach', 'threshold', 'chapel', 'beats'];
  it('has the five acts in order', () => {
    expect(Object.keys(ACTS)).toEqual(order);
  });
  it('spans are contiguous from 0 to 1', () => {
    let cursor = 0;
    for (const name of order) {
      const [start, end] = ACTS[name];
      expect(start).toBeCloseTo(cursor, 5);
      expect(end).toBeGreaterThan(start);
      cursor = end;
    }
    expect(cursor).toBeCloseTo(1, 5);
  });
});

describe('createState', () => {
  it('starts before the scene: path start, everything dark and still', () => {
    const s = createState();
    expect(s.pathT).toBe(0);
    expect(s.doorT).toBe(0);
    expect(s.crowT).toBe(0);
    expect(s.candleT).toBe(0);
    expect(s.crossGlow).toBe(0);
    expect(s.fireflies).toBe(0);
    expect(s.swayAmp).toBe(1);
    expect(s.fog).toBeGreaterThan(0);
    expect(s.route).toBe('direct');
  });
  it('returns independent objects', () => {
    const a = createState();
    const b = createState();
    a.pathT = 1;
    expect(b.pathT).toBe(0);
  });
});
