import { describe, it, expect } from 'vitest';
import {
  PROP_SPOTS, minPathClearance, roadEndT, roadSampleCount,
  SWAMP_CENTRE, SWAMP_RADIUS, swampReedSpots, swampTreeSpots, BIKE_SPOT,
  PINE_INNER, PINE_OUTER, HILL_RADIUS, pineSpots,
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

describe('the backdrop', () => {
  it('rings the scene beyond the graveyard, not through it', () => {
    expect(PINE_INNER).toBeGreaterThan(25);
    expect(PINE_OUTER).toBeGreaterThan(PINE_INNER);
    expect(HILL_RADIUS).toBeGreaterThan(PINE_OUTER);
  });
  it('places pines deterministically', () => {
    expect(pineSpots(50)).toEqual(pineSpots(50));
  });
  it('keeps the woods out of the road corridor and off the church', () => {
    for (const [x, z] of pineSpots(200)) {
      let near = Infinity;
      for (let i = 0; i <= 150; i++) {
        const p = positionAt(i / 150);
        near = Math.min(near, Math.hypot(p.x - x, p.z - z));
      }
      // Far enough that a pine never looms over the camera: at 7m a 6m tree
      // fills the frame, which is exactly what the first render did.
      expect(near).toBeGreaterThan(18);
      // The church sits around the doorway plane; nothing may grow through it.
      expect(Math.hypot(x, z + 5)).toBeGreaterThan(14);
    }
  });
});
