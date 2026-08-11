import { describe, it, expect } from 'vitest';
import {
  PROP_SPOTS, minPathClearance, roadEndT, roadSampleCount,
} from '../src/world/world.js';
import { positionAt } from '../src/world/path.js';

describe('PROP_SPOTS', () => {
  it('keeps every prop clear of the camera corridor', () => {
    expect(minPathClearance(PROP_SPOTS.graves)).toBeGreaterThan(1.4);
    expect(minPathClearance(PROP_SPOTS.trees)).toBeGreaterThan(2.0);
  });
  it('props are outdoors (positive z, before the door plane)', () => {
    for (const [, z] of [...PROP_SPOTS.graves, ...PROP_SPOTS.trees]) {
      expect(z).toBeGreaterThan(1);
    }
  });
  it('has enough set dressing to read as a dense graveyard', () => {
    expect(PROP_SPOTS.graves.length).toBeGreaterThanOrEqual(18);
    expect(PROP_SPOTS.trees.length).toBeGreaterThanOrEqual(9);
  });
});

describe('dirt roads', () => {
  it('lays a trail on both roads, not just the church one', () => {
    // The scenic road needs its own trail through the new graveyard and
    // back; without it the work route reads as walking over open ground.
    for (const route of ['direct', 'work']) {
      const endT = roadEndT(route);
      expect(endT).toBeGreaterThan(0.1);
      expect(endT).toBeLessThan(1);
      // The ribbon must stop outside the church, never down the aisle.
      expect(positionAt(endT, route).z).toBeGreaterThan(0);
    }
  });
  it('samples the longer road more finely so its curves do not facet', () => {
    expect(roadSampleCount('work')).toBeGreaterThan(roadSampleCount('direct'));
  });
});
