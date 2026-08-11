import { describe, it, expect } from 'vitest';
import { labelScreenPosition, labelOpacity } from '../src/labels.js';

describe('labelScreenPosition', () => {
  it('maps the NDC centre to the middle of the viewport', () => {
    expect(labelScreenPosition({ x: 0, y: 0 }, 1000, 800)).toEqual({ x: 500, y: 400 });
  });
  it('maps NDC corners to viewport corners, flipping y', () => {
    expect(labelScreenPosition({ x: -1, y: 1 }, 1000, 800)).toEqual({ x: 0, y: 0 });
    expect(labelScreenPosition({ x: 1, y: -1 }, 1000, 800)).toEqual({ x: 1000, y: 800 });
  });
});

describe('labelOpacity', () => {
  const range = { nearFade: 3, farFade: 25 };
  it('hides anything behind the camera', () => {
    expect(labelOpacity({ ndcZ: 1.5, distance: 10, ...range })).toBe(0);
  });
  it('hides anything past the far fade', () => {
    expect(labelOpacity({ ndcZ: 0.5, distance: 40, ...range })).toBe(0);
  });
  it('hides anything the camera has already passed', () => {
    expect(labelOpacity({ ndcZ: 0.5, distance: 1, ...range })).toBe(0);
  });
  it('is fully opaque in the comfortable reading band', () => {
    expect(labelOpacity({ ndcZ: 0.5, distance: 12, ...range })).toBe(1);
  });
  it('stays hidden when gated off, however good the geometry is', () => {
    expect(labelOpacity({ ndcZ: 0.5, distance: 12, ...range, enabled: false })).toBe(0);
  });
  it('fades in as a stone approaches and out as it passes', () => {
    const far = labelOpacity({ ndcZ: 0.5, distance: 22, ...range });
    const mid = labelOpacity({ ndcZ: 0.5, distance: 12, ...range });
    const near = labelOpacity({ ndcZ: 0.5, distance: 4, ...range });
    expect(far).toBeGreaterThan(0);
    expect(far).toBeLessThan(1);
    expect(mid).toBe(1);
    expect(near).toBeGreaterThan(0);
    expect(near).toBeLessThan(1);
  });
});
