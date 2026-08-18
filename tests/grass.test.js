import { describe, it, expect } from 'vitest';
import { buildTuftGeometry } from '../src/world/world.js';

function bounds(geo) {
  const p = geo.getAttribute('position');
  const b = { minY: Infinity, maxY: -Infinity, maxR: 0 };
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    b.minY = Math.min(b.minY, y);
    b.maxY = Math.max(b.maxY, y);
    b.maxR = Math.max(b.maxR, Math.hypot(p.getX(i), p.getZ(i)));
  }
  return b;
}

describe('grass tuft geometry', () => {
  it('is deterministic for a given seed', () => {
    const a = buildTuftGeometry({ seed: 7 }).getAttribute('position').array;
    const b = buildTuftGeometry({ seed: 7 }).getAttribute('position').array;
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('gives different tufts for different seeds', () => {
    const a = buildTuftGeometry({ seed: 1 }).getAttribute('position').array;
    const b = buildTuftGeometry({ seed: 2 }).getAttribute('position').array;
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it('plants every blade at the ground and never below it', () => {
    // The instanced transform puts the tuft's origin ON y=0, so any geometry
    // below y=0 would be buried under the ground disc.
    const b = bounds(buildTuftGeometry({ seed: 42 }));
    expect(b.minY).toBeCloseTo(0, 5);
    expect(b.maxY).toBeGreaterThan(0);
  });

  it('treats the requested height as a ceiling, for every seed', () => {
    // buildGrass multiplies this height by a per-instance vertical scale, so
    // `height` has to be a real bound rather than an average — otherwise the
    // tallest tufts overshoot whatever the caller budgeted. Swept across many
    // seeds because an earlier version of this test passed only by the luck
    // of the single seed it happened to use, while the builder could in fact
    // return blades 1.15x over the limit.
    for (let seed = 1; seed <= 200; seed++) {
      const b = bounds(buildTuftGeometry({ height: 0.7, seed }));
      expect(b.maxY).toBeLessThanOrEqual(0.7);
      expect(b.maxY).toBeGreaterThan(0.25); // and not degenerately short
    }
  });

  it('sprawls no further than its own lean allows, for every seed', () => {
    // The bound is analytic: the furthest a blade tip can reach is its
    // maximum lean, plus the root offset, plus half a blade's width.
    //
    // This governs how far grass encroaches on the road. buildGrass keeps
    // tufts 1.45m off the centreline against a road half-width of ~1.0m, so
    // the longest-leaning tufts put their TIPS just over the road's edge and
    // nothing else — which is the intent for a long-abandoned track. What it
    // must never do is reach the ruts, and that is what this bounds.
    const curve = 0.34;
    const spread = 0.06;
    const width = 0.045;
    const limit = curve * 1.6 + spread + width / 2;
    for (let seed = 1; seed <= 200; seed++) {
      expect(bounds(buildTuftGeometry({ curve, spread, width, seed })).maxR)
        .toBeLessThanOrEqual(limit);
    }
    // And that limit, scaled up by the widest instance, still leaves the
    // wheel ruts clear.
    expect(1.45 - limit * 1.3).toBeGreaterThan(0.5);
  });

  it('keeps the clump tight around its root', () => {
    // A tuft that sprawls wider than the placement clearance would put grass
    // on the dirt road however carefully the spots were chosen.
    const b = bounds(buildTuftGeometry({ curve: 0.34, spread: 0.06, seed: 5 }));
    expect(b.maxR).toBeLessThan(0.6);
  });

  it('carries the attributes the wind shader reads', () => {
    const geo = buildTuftGeometry({ blades: 4, segments: 4, seed: 9 });
    const verts = geo.getAttribute('position').count;
    expect(geo.getAttribute('aHeight').count).toBe(verts);
    expect(geo.getAttribute('aPhase').count).toBe(verts);
    expect(geo.getAttribute('color').count).toBe(verts);
    expect(geo.getAttribute('normal').count).toBe(verts);
  });

  it('ramps aHeight from 0 at the root to 1 at the tip', () => {
    const h = buildTuftGeometry({ blades: 1, segments: 4, seed: 11 }).getAttribute('aHeight');
    const values = [...Array(h.count).keys()].map((i) => h.getX(i));
    expect(Math.min(...values)).toBe(0);
    expect(Math.max(...values)).toBe(1);
  });

  it('builds two triangles per segment per blade', () => {
    const geo = buildTuftGeometry({ blades: 5, segments: 5, seed: 13 });
    expect(geo.getIndex().count).toBe(5 * 5 * 6);
  });

  it('darkens the root relative to the tip', () => {
    // Self-shadowing at the base is most of what makes a field read as
    // having depth rather than as a flat green mat.
    const geo = buildTuftGeometry({ blades: 1, segments: 4, seed: 17 });
    const h = geo.getAttribute('aHeight');
    const c = geo.getAttribute('color');
    let rootLum = 0;
    let tipLum = 0;
    for (let i = 0; i < h.count; i++) {
      const lum = c.getX(i) + c.getY(i) + c.getZ(i);
      if (h.getX(i) === 0) rootLum = lum;
      if (h.getX(i) === 1) tipLum = lum;
    }
    expect(tipLum).toBeGreaterThan(rootLum);
  });

  it('scales its triangle count with the requested detail', () => {
    const low = buildTuftGeometry({ blades: 3, segments: 3 }).getIndex().count;
    const high = buildTuftGeometry({ blades: 6, segments: 5 }).getIndex().count;
    expect(low).toBeLessThan(high);
  });
});
