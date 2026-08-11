import { describe, it, expect } from 'vitest';
import {
  MONUMENT_SPOTS, minWorkPathClearance, sideOfRoute,
} from '../src/world/monuments.js';
import { CREDITS } from '../src/content/portfolio.js';

describe('MONUMENT_SPOTS', () => {
  it('has exactly one stone per credit', () => {
    expect(MONUMENT_SPOTS).toHaveLength(CREDITS.length);
  });
  it('keeps every stone clear of the camera corridor', () => {
    expect(minWorkPathClearance()).toBeGreaterThan(1.4);
  });
  it('stands well back from the camera corridor, on both sides of the road', () => {
    // Far enough that the camera never brushes one, close enough to read.
    for (const [x] of MONUMENT_SPOTS) expect(Math.abs(x)).toBeGreaterThan(2);
    expect(minWorkPathClearance()).toBeGreaterThan(2.5);
  });
  it('flanks both sides of the road', () => {
    const sides = MONUMENT_SPOTS.map(([x, z]) => sideOfRoute(x, z));
    expect(sides.some((s) => s > 0)).toBe(true);
    expect(sides.some((s) => s < 0)).toBe(true);
  });
  it('spreads the stones along the row rather than bunching them', () => {
    const zs = MONUMENT_SPOTS.map(([, z]) => z);
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(6);
  });
});


