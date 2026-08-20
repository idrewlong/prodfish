import { describe, it, expect } from 'vitest';
import {
  MONUMENT_SPOTS, minWorkPathClearance, sideOfRoute, CROW_PERCH_STONE,
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



describe('the stone the lone crow perches on', () => {
  it('is a real stone, not an index past the end of the row', () => {
    expect(Number.isInteger(CROW_PERCH_STONE)).toBe(true);
    expect(CROW_PERCH_STONE).toBeGreaterThanOrEqual(0);
    expect(CROW_PERCH_STONE).toBeLessThan(MONUMENT_SPOTS.length);
  });

  it('is still the one beside the road, if this array is ever reordered', () => {
    // The bird spent a long time hovering at perching height over open
    // ground, 0.92m from the nearest stone, because its position was typed
    // in rather than derived. It is derived now — but only from the INDEX,
    // so a reshuffle of MONUMENT_SPOTS would move the bird somewhere else
    // entirely without anything else noticing. This is that alarm.
    const [x, z] = MONUMENT_SPOTS[CROW_PERCH_STONE];
    expect(x).toBeGreaterThan(0);          // right-hand side of the road
    expect(z).toBeGreaterThan(15);
    expect(z).toBeLessThan(21);
  });
});
