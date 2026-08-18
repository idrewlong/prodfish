import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { applySway, applyTreeSway } from '../src/world/world.js';

// Stands in for a three.js material: applySway only ever sets two callbacks.
function compile(opts) {
  const material = {};
  applySway(material, opts);
  const shader = {
    uniforms: {},
    // The two chunks applySway anchors its injection to. If three.js ever
    // renames them the replace() silently no-ops and the wind stops, so the
    // tests below assert the injected code is actually present.
    vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n}\n',
  };
  material.onBeforeCompile(shader);
  return { material, source: shader.vertexShader };
}

function balanced(src, open, close) {
  let depth = 0;
  for (const ch of src) {
    if (ch === open) depth += 1;
    if (ch === close) depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

describe('wind shader injection', () => {
  const { source } = compile({ amount: 0.075, speed: 0.55 });

  it('injects into both anchor chunks', () => {
    expect(source).toContain('#include <common>');
    expect(source).toContain('#include <begin_vertex>');
    expect(source).toContain('uniform float uWind;');
  });

  it('declares the attributes it reads', () => {
    // Three.js does not auto-declare custom attributes; a missing declaration
    // is a compile error, which means a black screen.
    expect(source).toContain('attribute float aHeight;');
    expect(source).toContain('attribute float aPhase;');
  });

  it('produces syntactically balanced source', () => {
    expect(balanced(source, '{', '}')).toBe(true);
    expect(balanced(source, '(', ')')).toBe(true);
  });

  it('contains no unresolved template placeholders', () => {
    // A stray ${...} would land in the GLSL verbatim and fail to compile.
    expect(source).not.toMatch(/\$\{/);
  });

  it('bakes the tuning values in as float literals', () => {
    // GLSL has no implicit int-to-float conversion; a bare `0` where a float
    // is expected is a compile error.
    expect(source).toContain('0.550'.slice(0, 4)); // speed
    expect(source).toContain('0.075'); // amount
  });

  it('guards instancing behind the USE_INSTANCING define', () => {
    // The same material is used non-instanced nowhere today, but referencing
    // instanceMatrix unguarded would break the moment it were.
    expect(source).toContain('#ifdef USE_INSTANCING');
    expect(source).toContain('#else');
    expect(source).toContain('#endif');
  });

  it('converts the wind into each instance’s local space', () => {
    // Without this the per-tuft yaw rotates the wind with the tuft and the
    // field splays outward instead of leaning together.
    expect(source).toContain('normalize(instanceMatrix[0].xyz)');
    expect(source).toContain('normalize(instanceMatrix[2].xyz)');
  });

  it('makes the gust travel across the field', () => {
    expect(source).toContain('dot(iPos, windDir)');
  });
});

// Builds a tree-sway material the way place() does, and compiles it.
function compileTree(opts = {}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 2, 1),
    new THREE.MeshStandardMaterial(),
  );
  applyTreeSway(mesh, opts);
  const shader = {
    uniforms: {},
    vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n}\n',
  };
  mesh.material.onBeforeCompile(shader);
  return { material: mesh.material, source: shader.vertexShader, uniforms: shader.uniforms };
}

describe('tree sway', () => {
  it('declares every uniform it reads', () => {
    const { source, uniforms } = compileTree();
    for (const u of ['uWind', 'uSwayDir', 'uSwayPhase', 'uSwayTravel', 'uSwayBase', 'uSwaySpan']) {
      expect(source).toContain(`uniform`);
      expect(source).toContain(u);
      expect(uniforms[u]).toBeDefined();
    }
  });

  it('shares one uWind uniform with the grass, so gusts stay in step', () => {
    const grass = new THREE.MeshLambertMaterial();
    applySway(grass, { amount: 0.075, speed: 0.55 });
    const gShader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>' };
    grass.onBeforeCompile(gShader);
    const tree = compileTree();
    // Same object identity, not merely the same value: one clock for the
    // whole scene's weather.
    expect(tree.uniforms.uWind).toBe(gShader.uniforms.uWind);
  });

  it('measures height from the geometry rather than a hardcoded size', () => {
    const { uniforms } = compileTree();
    expect(uniforms.uSwayBase.value).toBe(-1); // a 2-unit box centred on origin
    expect(uniforms.uSwaySpan.value).toBe(2);
  });

  it('rotates the wind into the tree’s local frame', () => {
    // A tree yawed 90 degrees must bend along a swapped local axis, or every
    // tree would lean whichever way its own model happens to face.
    const straight = compileTree({ rotY: 0 }).uniforms.uSwayDir.value;
    const turned = compileTree({ rotY: Math.PI / 2 }).uniforms.uSwayDir.value;
    expect(turned.x).toBeCloseTo(-straight.y, 5);
    expect(turned.y).toBeCloseTo(straight.x, 5);
  });

  it('flips the local wind axis for a mirrored tree', () => {
    // place() mirrors half the trees with a negative X scale, which flips
    // their local X axis; without this they would bend into the wind.
    const normal = compileTree({ rotY: 0.7 }).uniforms.uSwayDir.value;
    const mirrored = compileTree({ rotY: 0.7, mirror: true }).uniforms.uSwayDir.value;
    expect(mirrored.x).toBeCloseTo(-normal.x, 6);
    expect(mirrored.y).toBeCloseTo(normal.y, 6);
  });

  it('keeps the local wind direction unit-length under rotation', () => {
    for (const rotY of [0, 0.4, 1.9, -2.7, Math.PI]) {
      const d = compileTree({ rotY }).uniforms.uSwayDir.value;
      expect(Math.hypot(d.x, d.y)).toBeCloseTo(Math.hypot(0.82, 0.57), 6);
    }
  });

  it('places trees at different points in the gust', () => {
    const near = compileTree({ origin: [0, 0] }).uniforms.uSwayTravel.value;
    const far = compileTree({ origin: [10, 20] }).uniforms.uSwayTravel.value;
    expect(near).not.toBe(far);
  });

  it('emits ASCII-only source', () => {
    // GLSL's source character set excludes typographic punctuation, and
    // strict drivers reject a shader containing it even inside a comment.
    // An em-dash in a comment here once made it into the generated source.
    const { source } = compileTree();
    expect([...source].every((ch) => ch.charCodeAt(0) < 128)).toBe(true);
  });

  it('is balanced and has no unresolved placeholders', () => {
    const { source } = compileTree();
    expect(balanced(source, '{', '}')).toBe(true);
    expect(balanced(source, '(', ')')).toBe(true);
    expect(source).not.toMatch(/\$\{/);
  });
});

describe('shader program cache key', () => {
  it('differs when the tuning differs', () => {
    // three.js keys its program cache on onBeforeCompile.toString(), which is
    // identical for every call here, so without an explicit key the grass and
    // the reeds share one compiled shader.
    const grass = compile({ amount: 0.075, speed: 0.55 }).material;
    const reeds = compile({ amount: 0.13, speed: 0.42 }).material;
    expect(grass.customProgramCacheKey()).not.toBe(reeds.customProgramCacheKey());
  });

  it('matches for identical tuning', () => {
    const a = compile({ amount: 0.075, speed: 0.55 }).material;
    const b = compile({ amount: 0.075, speed: 0.55 }).material;
    expect(a.customProgramCacheKey()).toBe(b.customProgramCacheKey());
  });
});
