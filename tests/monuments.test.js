import { describe, it, expect } from 'vitest';
import {
  MONUMENT_SPOTS, minWorkPathClearance, minDirectPathDistance, sideOfRoute,
} from '../src/world/monuments.js';
import { CREDITS } from '../src/content/portfolio.js';

describe('MONUMENT_SPOTS', () => {
  it('has exactly one stone per credit', () => {
    expect(MONUMENT_SPOTS).toHaveLength(CREDITS.length);
  });
  it('keeps every stone clear of the camera corridor', () => {
    expect(minWorkPathClearance()).toBeGreaterThan(1.4);
  });
  it('places stones out along the detour, well clear of the direct path', () => {
    for (const [x] of MONUMENT_SPOTS) expect(x).toBeGreaterThan(4);
    expect(minDirectPathDistance()).toBeGreaterThan(4);
  });
  it('flanks both sides of the route', () => {
    // Compare against the route's own direction rather than a fixed x, so
    // this keeps meaning something if the curve is ever retuned.
    const sides = MONUMENT_SPOTS.map(([x, z]) => sideOfRoute(x, z));
    expect(sides.some((s) => s > 0)).toBe(true);
    expect(sides.some((s) => s < 0)).toBe(true);
  });
  it('spreads the stones along the row rather than bunching them', () => {
    const zs = MONUMENT_SPOTS.map(([, z]) => z);
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(6);
  });
});
