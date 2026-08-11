import { describe, it, expect } from 'vitest';
import {
  PROP_SPOTS, minPathClearance, roadEndT, roadSampleCount,
  SWAMP_CENTRE, SWAMP_RADIUS, swampReedSpots, swampTreeSpots, BIKE_SPOT,
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
  it('stops the trail outside the church, never down the aisle', () => {
    const endT = roadEndT();
    expect(endT).toBeGreaterThan(0.1);
    expect(endT).toBeLessThan(1);
    expect(positionAt(endT).z).toBeGreaterThan(0);
  });
  it('samples finely enough that the curve does not facet', () => {
    expect(roadSampleCount()).toBeGreaterThan(100);
  });
});

describe('the swamp', () => {
  it('sits on the church approach, so the road crosses it', () => {
    // The marsh IS the journey now, not a place off to one side: the road
    // must run through it rather than past it.
    let min = Infinity;
    for (let i = 0; i <= 200; i++) {
      const p = positionAt(i / 200);
      min = Math.min(min, Math.hypot(p.x - SWAMP_CENTRE[0], p.z - SWAMP_CENTRE[1]));
    }
    expect(min).toBeLessThan(SWAMP_RADIUS * 0.5);
  });
  it('places reeds deterministically', () => {
    expect(swampReedSpots(40)).toEqual(swampReedSpots(40));
  });
  it('keeps reeds and trees out of the camera corridor', () => {
    const clearance = (x, z) => {
      let min = Infinity;
      for (let i = 0; i <= 200; i++) {
        const p = positionAt(i / 200);
        min = Math.min(min, Math.hypot(p.x - x, p.z - z));
      }
      return min;
    };
    for (const [x, z] of swampReedSpots(80)) expect(clearance(x, z)).toBeGreaterThan(1.0);
    for (const [x, z] of swampTreeSpots()) expect(clearance(x, z)).toBeGreaterThan(2.0);
  });
});

describe('the abandoned bike', () => {
  it('sits clear of the camera corridor', () => {
    const [x, z] = BIKE_SPOT;
    let min = Infinity;
    for (let i = 0; i <= 300; i++) {
      const p = positionAt(i / 300);
      min = Math.min(min, Math.hypot(p.x - x, p.z - z));
    }
    expect(min).toBeGreaterThan(2.0);
  });
});
