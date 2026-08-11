import { describe, it, expect } from 'vitest';
import {
  MONUMENT_SPOTS, minWorkPathClearance, minDirectPathDistance, sideOfRoute,
  SIGNPOST_SPOT, minDistanceToRouteFor,
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
  it('stands the signpost clear of the camera corridor on both routes', () => {
    const [x, z] = SIGNPOST_SPOT;
    expect(minDistanceToRouteFor(x, z, 'work')).toBeGreaterThan(1.4);
    expect(minDistanceToRouteFor(x, z, 'direct')).toBeGreaterThan(1.4);
  });
});

import { SIGNPOST_ROT_Y, signViewAngleDeg } from '../src/world/monuments.js';

describe('signpost framing', () => {
  it('sits in front of the camera when the journey parks at the fork', () => {
    // Guards the bug this task fixes: a sign behind the camera at the moment
    // of the choice. Anything past ~25 degrees drifts to the frame edge.
    expect(signViewAngleDeg()).toBeLessThan(25);
  });
  it('still clears both roads', () => {
    const [x, z] = SIGNPOST_SPOT;
    expect(minDistanceToRouteFor(x, z, 'work')).toBeGreaterThan(1.4);
    expect(minDistanceToRouteFor(x, z, 'direct')).toBeGreaterThan(1.4);
  });
  it('is turned to face the parked camera rather than down the road', () => {
    expect(SIGNPOST_ROT_Y).toBeGreaterThan(0.4);
    expect(SIGNPOST_ROT_Y).toBeLessThan(0.9);
  });
});
