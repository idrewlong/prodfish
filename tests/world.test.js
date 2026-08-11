import { describe, it, expect } from 'vitest';
import {
  PROP_SPOTS, minPathClearance, roadEndT, roadSampleCount,
  SWAMP_CENTRE, SWAMP_RADIUS, swampReedSpots, swampTreeSpots, CHAPEL_KEEP_OUT,
} from '../src/world/world.js';
import { CHAPEL_CENTRE } from '../src/world/chapelOfWork.js';
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

describe('the swamp', () => {
  it('sits around the monument row, not around the church', () => {
    // The two places must read as different countries: the swamp dressing
    // belongs to the scenic road, and the church approach must stay dry.
    expect(Math.hypot(SWAMP_CENTRE[0], SWAMP_CENTRE[1])).toBeGreaterThan(SWAMP_RADIUS);
  });
  it('places reeds deterministically', () => {
    expect(swampReedSpots(40)).toEqual(swampReedSpots(40));
  });
  it('keeps reeds and trees out of the camera corridor', () => {
    const clearance = (x, z) => {
      let min = Infinity;
      for (let i = 0; i <= 200; i++) {
        const p = positionAt(i / 200, 'work');
        min = Math.min(min, Math.hypot(p.x - x, p.z - z));
      }
      return min;
    };
    for (const [x, z] of swampReedSpots(80)) expect(clearance(x, z)).toBeGreaterThan(1.0);
    for (const [x, z] of swampTreeSpots()) expect(clearance(x, z)).toBeGreaterThan(2.0);
  });
});

describe('the rider’s chapel clearing', () => {
  it('keeps reeds from growing inside the building', () => {
    for (const [x, z] of swampReedSpots(200)) {
      const d = Math.hypot(x - CHAPEL_CENTRE[0], z - CHAPEL_CENTRE[1]);
      expect(d).toBeGreaterThan(CHAPEL_KEEP_OUT);
    }
  });
});
