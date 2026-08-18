import { describe, it, expect } from 'vitest';
import {
  PROP_SPOTS, minPathClearance, roadEndT, roadSampleCount,
  SWAMP_CENTRE, SWAMP_RADIUS, swampReedSpots, swampTreeSpots,
  WATCHER_SPOTS, boulderSpots, POOLS, poolOutline,
  poolShapes, groundHeightAt, BASIN_DEPTH, WATER_LEVEL, buildGroundGeometry,
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

function corridorClearance(x, z) {
  let min = Infinity;
  for (let i = 0; i <= 300; i++) {
    const p = positionAt(i / 300);
    min = Math.min(min, Math.hypot(p.x - x, p.z - z));
  }
  return min;
}

describe('the watchers', () => {
  it('stand back among the trees, not on the road', () => {
    // Close enough to register as figures, far enough that they are only
    // really resolved when the lightning picks them out.
    for (const [x, z] of WATCHER_SPOTS) {
      const d = corridorClearance(x, z);
      expect(d).toBeGreaterThan(7);
      expect(d).toBeLessThan(14);
    }
  });

  it('are spread along the approach rather than bunched', () => {
    const zs = WATCHER_SPOTS.map(([, z]) => z).sort((a, b) => a - b);
    for (let i = 1; i < zs.length; i++) expect(zs[i] - zs[i - 1]).toBeGreaterThan(5);
  });

  it('face the road', () => {
    // Turned to look back at the path, so a strike always catches them
    // looking at the visitor rather than showing three backs.
    for (const [x, , rotY] of WATCHER_SPOTS) {
      // A watcher on the left (negative x) must face right, and vice versa.
      expect(Math.sign(Math.sin(rotY))).toBe(Math.sign(-x));
    }
  });
});

describe('mossy boulders', () => {
  it('are deterministic', () => {
    expect(boulderSpots()).toEqual(boulderSpots());
  });

  it('keep off the road', () => {
    for (const [x, z] of boulderSpots()) {
      expect(corridorClearance(x, z)).toBeGreaterThan(2.5);
    }
  });

  it('never land inside a gravestone or tree', () => {
    const props = [...PROP_SPOTS.graves, ...PROP_SPOTS.trees];
    for (const [x, z] of boulderSpots()) {
      const nearest = Math.min(...props.map(([px, pz]) => Math.hypot(px - x, pz - z)));
      expect(nearest).toBeGreaterThan(2.1);
    }
  });

  it('do not pile on top of each other', () => {
    const spots = boulderSpots();
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        expect(Math.hypot(spots[i][0] - spots[j][0], spots[i][1] - spots[j][1]))
          .toBeGreaterThan(2.9);
      }
    }
  });

  it('scatters enough of them to read as scattered', () => {
    expect(boulderSpots().length).toBeGreaterThanOrEqual(8);
  });

  it('never stands one in the water', () => {
    // A boulder is buried into the GROUND. Inside a pool the water surface
    // hides the ground it is buried in, so the rock reads as floating on the
    // pond -- which is how 4 of the 11 looked before the pools were excluded.
    const polys = POOLS.map(poolOutline);
    for (const [x, z] of boulderSpots()) {
      for (const poly of polys) {
        let hit = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const [xi, zi] = poly[i];
          const [xj, zj] = poly[j];
          if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
        }
        expect(hit).toBe(false);
      }
      // And not so near the bank that the waterline cuts across the rock.
      const toEdge = Math.min(
        ...polys.flatMap((poly) => poly.map(([ex, ez]) => Math.hypot(ex - x, ez - z))),
      );
      expect(toEdge).toBeGreaterThan(1.5);
    }
  });

  it('never stands one inside a watcher', () => {
    for (const [x, z] of boulderSpots()) {
      for (const [wx, wz] of WATCHER_SPOTS) {
        expect(Math.hypot(x - wx, z - wz)).toBeGreaterThan(1.7);
      }
    }
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

describe('the swamp pools', () => {
  const outlines = POOLS.map(poolOutline);

  function insidePolygon(px, pz, poly) {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i];
      const [xj, zj] = poly[j];
      if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) hit = !hit;
    }
    return hit;
  }

  it('never floods the road', () => {
    // THE regression this guards. The water used to be one 17m disc centred
    // at [0,30] -- directly over the road -- so 59% of the camera path ran
    // through it and the dirt ribbon floated on the surface.
    for (let i = 0; i <= 600; i++) {
      const p = positionAt(i / 600);
      for (const poly of outlines) expect(insidePolygon(p.x, p.z, poly)).toBe(false);
    }
  });

  it('keeps a bank between the water and the camera', () => {
    let nearest = Infinity;
    for (let i = 0; i <= 400; i++) {
      const p = positionAt(i / 400);
      for (const poly of outlines) {
        for (const [x, z] of poly) nearest = Math.min(nearest, Math.hypot(p.x - x, p.z - z));
      }
    }
    expect(nearest).toBeGreaterThan(2);
  });

  it('has an irregular shoreline rather than a circle', () => {
    // A constant radius is the single biggest tell that water is a primitive.
    for (const [i, poly] of outlines.entries()) {
      const c = POOLS[i].centre;
      const radii = poly.map(([x, z]) => Math.hypot(x - c[0], z - c[1]));
      const spread = (Math.max(...radii) - Math.min(...radii)) / Math.max(...radii);
      expect(spread).toBeGreaterThan(0.25);
    }
  });

  it('stays star-shaped so the fan triangulation is valid', () => {
    // buildPool fans from the centre; a point pulled past the centre would
    // fold the polygon inside out.
    for (const [i, poly] of outlines.entries()) {
      const c = POOLS[i].centre;
      for (const [x, z] of poly) expect(Math.hypot(x - c[0], z - c[1])).toBeGreaterThan(0.4);
    }
  });

  it('is deterministic', () => {
    expect(POOLS.map(poolOutline)).toEqual(POOLS.map(poolOutline));
  });

  it('flanks the causeway on both sides', () => {
    const sides = POOLS.map((p) => Math.sign(p.centre[0]));
    expect(new Set(sides).size).toBe(2);
  });
});

describe('the pond basins', () => {
  const shapes = poolShapes();

  function inPond(x, z) {
    return shapes.some(({ outline }) => {
      let hit = false;
      for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
        const [xi, zi] = outline[i];
        const [xj, zj] = outline[j];
        if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
      }
      return hit;
    });
  }

  it('drowns nothing', () => {
    // The first siting of these ponds checked only their distance from the
    // ROAD, and they swallowed 8 gravestones, 5 trees and 3 watchers --
    // markers standing in open water, trees growing out of a pond. The
    // outline now clamps against the props as well as the path.
    const props = [
      ...PROP_SPOTS.graves, ...PROP_SPOTS.trees, ...WATCHER_SPOTS, ...boulderSpots(),
    ];
    for (const [x, z] of props) expect(inPond(x, z)).toBe(false);
  });

  it('leaves the causeway perfectly level', () => {
    // The road is a flat ribbon at y=0.012. Any dip beneath it and the road
    // hangs in mid-air over the hollow.
    for (let i = 0; i <= 600; i++) {
      const p = positionAt(i / 600);
      expect(groundHeightAt(p.x, p.z)).toBeCloseTo(0, 6);
    }
  });

  it('holds water without the bed showing through', () => {
    // Water sits at WATER_LEVEL in a basin cut to BASIN_DEPTH, so the pond is
    // full to its brim -- the point of carving it at all.
    expect(WATER_LEVEL).toBeGreaterThan(-BASIN_DEPTH);
    expect(WATER_LEVEL).toBeLessThan(0);
    for (const { centre } of shapes) {
      expect(groundHeightAt(centre[0], centre[1])).toBeLessThan(WATER_LEVEL);
    }
  });

  it('slopes back up to the field, so there is a visible bank', () => {
    // Flat water on flat ground reads as paper laid on a table; the bank is
    // the depth cue.
    for (const { centre, outline } of shapes) {
      const [ox, oz] = outline[0];
      const a = Math.atan2(oz - centre[1], ox - centre[0]);
      const rim = Math.hypot(ox - centre[0], oz - centre[1]);
      const atShore = groundHeightAt(ox, oz);
      const outside = groundHeightAt(
        centre[0] + Math.cos(a) * (rim + 4),
        centre[1] + Math.sin(a) * (rim + 4),
      );
      expect(atShore).toBeLessThan(0);
      expect(outside).toBeCloseTo(0, 3);
    }
  });

  it('stays small enough to fit the graveyard', () => {
    for (const { centre, outline } of shapes) {
      const radii = outline.map(([x, z]) => Math.hypot(x - centre[0], z - centre[1]));
      expect(Math.max(...radii)).toBeLessThan(9);
    }
  });
});

describe('the ground mesh actually carries the basins', () => {
  // groundHeightAt describing a basin is not the same as the MESH having the
  // resolution to express one. The ground was previously a radial grid centred
  // on the world origin, whose angular spacing grows with distance: a pond 40m
  // out got 2.9 x 1.6 vertices across it, no basin was carved, the ground
  // stayed flat at y=0 and the water sitting below it disappeared entirely.
  // These run against the real geometry, at both tiers' settings.
  for (const [tier, groundStep] of [['high', 0.7], ['low', 1.2]]) {
    it(`digs a real hollow at ${tier} tier`, () => {
      const geo = buildGroundGeometry({ groundStep });
      const pos = geo.getAttribute('position');

      for (const { centre, outline } of poolShapes()) {
        const reach = Math.max(...outline.map(([x, z]) => Math.hypot(x - centre[0], z - centre[1])));
        let deepest = 0;
        let belowWaterline = 0;
        for (let i = 0; i < pos.count; i++) {
          const dx = pos.getX(i) - centre[0];
          const dz = pos.getZ(i) - centre[1];
          if (Math.hypot(dx, dz) > reach) continue;
          deepest = Math.min(deepest, pos.getY(i));
          if (pos.getY(i) < WATER_LEVEL) belowWaterline += 1;
        }
        // The bed has to reach most of the way down...
        expect(deepest).toBeLessThan(-BASIN_DEPTH * 0.8);
        // ...over enough vertices that there is a surface to see water on.
        expect(belowWaterline).toBeGreaterThan(8);
      }
    });
  }

  it('leaves the field beyond the ponds flat', () => {
    const pos = buildGroundGeometry({ groundStep: 0.7 }).getAttribute('position');
    const shapes = poolShapes();
    for (let i = 0; i < pos.count; i++) {
      const far = shapes.every(({ centre, outline }) => {
        const reach = Math.max(...outline.map(([x, z]) => Math.hypot(x - centre[0], z - centre[1])));
        return Math.hypot(pos.getX(i) - centre[0], pos.getZ(i) - centre[1]) > reach + 4;
      });
      if (far) expect(pos.getY(i)).toBeCloseTo(0, 5);
    }
  });
});
