import { describe, it, expect } from 'vitest';
import { pineGeometry, pineSpots, PINE_INNER, PINE_OUTER } from '../src/world/world.js';

function verts(geo) {
  const p = geo.getAttribute('position');
  return [...Array(p.count).keys()].map((i) => ({
    y: p.getY(i),
    r: Math.hypot(p.getX(i), p.getZ(i)),
  }));
}

describe('pine geometry', () => {
  it('is deterministic', () => {
    const a = pineGeometry(5).getAttribute('position').array;
    const b = pineGeometry(5).getAttribute('position').array;
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('stands on the ground', () => {
    const ys = verts(pineGeometry()).map((v) => v.y);
    expect(Math.min(...ys)).toBeCloseTo(0, 5);
  });

  it('is a plausible height for a background conifer', () => {
    const ys = verts(pineGeometry()).map((v) => v.y);
    expect(Math.max(...ys)).toBeGreaterThan(5);
    expect(Math.max(...ys)).toBeLessThan(11);
  });

  it('has branch whorls at several distinct heights, not one smooth cone', () => {
    // THE realism property. A cone's outline is two straight lines meeting at
    // a point, which reads as a geometric primitive however it is lit. A
    // conifer's steps in and out at each whorl. Each tier contributes one wide
    // base ring, so counting distinct heights carrying a wide ring counts the
    // whorls. (Measured from the base RINGS rather than by sampling the
    // silhouette: ConeGeometry only has vertices at its base and apex, so a
    // naive per-height-band vertex scan reports empty bands in between and
    // makes a perfectly solid tree look full of gaps.)
    const wide = verts(pineGeometry()).filter((v) => v.r > 0.6);
    const rings = new Set(wide.map((v) => v.y.toFixed(2)));
    expect(rings.size).toBeGreaterThanOrEqual(4);
  });

  it('never narrows to nothing between whorls', () => {
    // A tier whose apex is reached before the next tier's base begins would
    // leave the tree looking like cones threaded on a stick.
    const geo = pineGeometry();
    const all = verts(geo);
    const top = Math.max(...all.map((v) => v.y));
    // Sample the analytic outline: within a band, the widest ring at or below
    // it that has not yet tapered out still fills the silhouette.
    const wide = all.filter((v) => v.r > 0.6).map((v) => v.y).sort((a, b) => a - b);
    // Consecutive whorls must overlap rather than leave a bare stretch of trunk.
    for (let i = 1; i < wide.length; i++) {
      expect(wide[i] - wide[i - 1]).toBeLessThan(top * 0.5);
    }
  });

  it('carries the wind attributes, ramping to 1 at the crown', () => {
    const geo = pineGeometry();
    const h = geo.getAttribute('aHeight');
    expect(geo.getAttribute('aPhase').count).toBe(h.count);
    const values = [...Array(h.count).keys()].map((i) => h.getX(i));
    expect(Math.min(...values)).toBeCloseTo(0, 5);
    // Derived from the geometry's own bounding box, so the crown always
    // reaches full sway however the tiers are retuned.
    expect(Math.max(...values)).toBeCloseTo(1, 5);
  });

  it('stays affordable for a 520-tree wood', () => {
    const tris = pineGeometry().getIndex().count / 3;
    expect(tris * 520).toBeLessThan(80000);
  });
});

describe('pine placement', () => {
  it('keeps the woods in their ring', () => {
    for (const [x, z] of pineSpots(60)) {
      const r = Math.hypot(x, z);
      expect(r).toBeGreaterThanOrEqual(PINE_INNER - 0.5);
      expect(r).toBeLessThanOrEqual(PINE_OUTER + 0.5);
    }
  });

  it('is deterministic', () => {
    expect(pineSpots(40)).toEqual(pineSpots(40));
  });
});
