import { describe, it, expect } from 'vitest';
import { buildSwampTree, applyBranchSway } from '../src/world/trees.js';
import { PROP_SPOTS, swampTreeSpots } from '../src/world/world.js';
import { positionAt } from '../src/world/path.js';

function parts(geo) {
  const p = geo.getAttribute('position');
  const f = geo.getAttribute('aFlex');
  const bark = [];
  const moss = [];
  for (let i = 0; i < p.count; i++) {
    const v = { x: p.getX(i), y: p.getY(i), z: p.getZ(i) };
    v.r = Math.hypot(v.x, v.z);
    (f.getX(i) > 1.01 ? moss : bark).push(v);
  }
  return { bark, moss };
}

describe('swamp tree geometry', () => {
  it('is deterministic for a seed', () => {
    const a = buildSwampTree({ seed: 21 }).getAttribute('position').array;
    const b = buildSwampTree({ seed: 21 }).getAttribute('position').array;
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('grows a different tree for every seed', () => {
    const a = buildSwampTree({ seed: 1 }).getAttribute('position').array;
    const b = buildSwampTree({ seed: 2 }).getAttribute('position').array;
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it('hits the requested height exactly and stands on the ground', () => {
    // Growth is a chain of random lengths and angles, so the raw result
    // drifts by metres between seeds; buildSwampTree normalises afterwards.
    // Callers place these against a measured road corridor and a camera at
    // eye height, where "about seven metres" is not good enough.
    for (const seed of [3, 11, 29, 47, 88, 150]) {
      const geo = buildSwampTree({ height: 7, seed });
      expect(geo.boundingBox.max.y).toBeCloseTo(7, 4);
      expect(geo.boundingBox.min.y).toBeCloseTo(0, 4);
    }
  });

  it('has live-oak proportions, not a bush and not a spire', () => {
    // The first tuning pass produced 7.8m wide by 4.5m tall, which is a bush.
    for (const seed of [3, 11, 29, 47, 88]) {
      const bb = buildSwampTree({ height: 7, seed }).boundingBox;
      const ratio = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / bb.max.y;
      expect(ratio).toBeGreaterThan(0.6);
      expect(ratio).toBeLessThan(1.5);
    }
  });

  it('keeps a clear trunk under a spreading crown', () => {
    // The shape the whole thing exists for: a bare trunk the camera walks
    // past, then a crown that spreads overhead. A tree whose foliage starts
    // at knee height is the lollipop this replaced.
    const { bark } = parts(buildSwampTree({ height: 7, seed: 29 }));
    const trunkBand = bark.filter((v) => v.y > 1.2 && v.y < 2.4);
    const crownBand = bark.filter((v) => v.y > 3.5 && v.y < 6);
    expect(Math.max(...trunkBand.map((v) => v.r))).toBeLessThan(1);
    expect(Math.max(...crownBand.map((v) => v.r))).toBeGreaterThan(2);
  });

  it('flares at the base into buttress roots', () => {
    const { bark } = parts(buildSwampTree({ height: 7, seed: 29 }));
    const atGround = Math.max(...bark.filter((v) => v.y < 0.4).map((v) => v.r));
    const atTrunk = Math.max(...bark.filter((v) => v.y > 1.5 && v.y < 2).map((v) => v.r));
    expect(atGround).toBeGreaterThan(atTrunk);
  });

  it('hangs moss from the crown and nowhere else', () => {
    const { moss } = parts(buildSwampTree({ height: 7, seed: 29 }));
    expect(moss.length).toBeGreaterThan(50);
    // Moss growing off the trunk at head height would look like seaweed.
    expect(Math.min(...moss.map((v) => v.y))).toBeGreaterThan(1.5);
  });

  it('makes moss far more flexible than bark', () => {
    const geo = buildSwampTree({ seed: 29 });
    const f = geo.getAttribute('aFlex');
    const values = [...Array(f.count).keys()].map((i) => f.getX(i));
    expect(Math.min(...values)).toBe(1); // bark
    expect(Math.max(...values)).toBeGreaterThan(3); // moss tips whip
  });

  it('ramps aHeight from 0 to 1 after normalisation', () => {
    const h = buildSwampTree({ height: 7, seed: 47 }).getAttribute('aHeight');
    const values = [...Array(h.count).keys()].map((i) => h.getX(i));
    expect(Math.min(...values)).toBeCloseTo(0, 4);
    expect(Math.max(...values)).toBeCloseTo(1, 4);
  });

  it('costs less than the decimated model it replaced', () => {
    // The GLB was 2,780 triangles per tree, and looked worse, because a
    // decimator deletes thin limbs first.
    for (const seed of [3, 29, 88]) {
      expect(buildSwampTree({ height: 7, seed }).getIndex().count / 3).toBeLessThan(2780);
    }
  });
});

describe('trees never touch the camera', () => {
  // The crowns deliberately overhang the path so the visitor walks under the
  // moss. That is only atmospheric while nothing actually reaches the lens —
  // a limb or a moss strand intersecting the camera would smear across the
  // whole frame. Lengthening the moss or widening the crown could break this
  // silently, so it is measured rather than assumed.
  const camera = [];
  for (let i = 0; i <= 200; i++) camera.push(positionAt(i / 200));

  function nearestApproach(geo, tx, tz, rotY) {
    const p = geo.getAttribute('position');
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    let min = Infinity;
    for (let k = 0; k < p.count; k++) {
      const x0 = p.getX(k);
      const y = p.getY(k);
      const z0 = p.getZ(k);
      const x = tx + x0 * c + z0 * s;
      const z = tz - x0 * s + z0 * c;
      for (const q of camera) {
        const d = Math.hypot(q.x - x, q.y - y, q.z - z);
        if (d < min) min = d;
      }
    }
    return min;
  }

  it('leaves the avenue oaks well clear of the lens', () => {
    let worst = Infinity;
    PROP_SPOTS.trees.forEach(([x, z, rotY, s], i) => {
      // Built at the upper end of the size jitter plantTrees applies.
      const geo = buildSwampTree({
        height: 7 * s * 1.16, seed: 0x77ee01 + i * 7919, moss: 36, mossLength: 2.0,
      });
      worst = Math.min(worst, nearestApproach(geo, x, z, rotY));
    });
    expect(worst).toBeGreaterThan(1.5);
  });

  it('leaves the marsh cypress clear of the lens', () => {
    let worst = Infinity;
    swampTreeSpots().forEach(([x, z, rotY, s], i) => {
      const geo = buildSwampTree({
        height: 8.5 * s * 1.16, seed: 0xdead7233 + i * 7919, moss: 22, mossLength: 2.75,
      });
      worst = Math.min(worst, nearestApproach(geo, x, z, rotY));
    });
    expect(worst).toBeGreaterThan(1.5);
  });
});

describe('branch sway shader', () => {
  function compile(opts = {}) {
    const material = {};
    applyBranchSway(material, opts);
    const shader = {
      uniforms: {},
      vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n}\n',
    };
    material.onBeforeCompile(shader);
    return { material, source: shader.vertexShader, uniforms: shader.uniforms };
  }

  it('declares the three attributes it reads', () => {
    const { source } = compile();
    expect(source).toContain('attribute float aHeight;');
    expect(source).toContain('attribute float aFlex;');
    expect(source).toContain('attribute float aPhase;');
  });

  it('emits ASCII-only, balanced source with no placeholders', () => {
    const { source } = compile();
    expect([...source].every((ch) => ch.charCodeAt(0) < 128)).toBe(true);
    expect(source).not.toMatch(/\$\{/);
    let depth = 0;
    for (const ch of source) {
      if (ch === '{') depth += 1;
      if (ch === '}') depth -= 1;
      expect(depth).toBeGreaterThanOrEqual(0);
    }
    expect(depth).toBe(0);
  });

  it('rotates the wind into the tree’s local frame', () => {
    const straight = compile({ rotY: 0 }).uniforms.uSwayDir.value;
    const turned = compile({ rotY: Math.PI / 2 }).uniforms.uSwayDir.value;
    expect(turned.x).toBeCloseTo(-straight.y, 5);
    expect(turned.y).toBeCloseTo(straight.x, 5);
  });

  it('separates the cache key by tuning', () => {
    expect(compile({ amount: 0.05, speed: 0.21 }).material.customProgramCacheKey())
      .not.toBe(compile({ amount: 0.075, speed: 0.26 }).material.customProgramCacheKey());
  });
});
