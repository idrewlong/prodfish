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
  it('starts before the scene: camera far, everything dark', () => {
    const s = createState();
    expect(s.camZ).toBe(14);
    expect(s.exteriorOpacity).toBe(0);
    expect(s.thresholdOpacity).toBe(0);
    expect(s.interiorOpacity).toBe(0);
  });
  it('returns independent objects', () => {
    const a = createState();
    const b = createState();
    a.camZ = 0;
    expect(b.camZ).toBe(14);
  });
});
