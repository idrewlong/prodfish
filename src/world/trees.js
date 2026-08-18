// Procedural southern-gothic swamp trees: gnarled forking limbs over a
// flared buttressed trunk, hung with Spanish moss.
//
// WHY THESE ARE GENERATED RATHER THAN MODELLED
//
// The trees these replace were image-to-3D output decimated from ~29,900
// triangles to 2,780 — a 91% cut. A branching tree is the worst possible
// subject for that: the thin limb structure which is the ONLY thing that
// makes a tree read as a tree is exactly what a decimator deletes first,
// because it contributes the least surface area. What survived was a
// lollipop — a thin stalk under one round canopy mass, measured at 1.4 wide
// by 1.8 tall with 22k of its 48k vertices inside two canopy bands — with
// daylight baked into its texture, fighting the moonlight instead of
// receiving it.
//
// Generating the tree instead spends every triangle on the silhouette, which
// is the only thing that survives fog and night anyway. A convincing tree
// lands around 1,200 triangles here, well under half what the decimated
// model cost.
//
// And it is the only way to get Spanish moss. Moss is the single most
// identifiable thing about a swamp tree, and no general-purpose tree model
// carries it — it would have to be a separate geometry layer whatever the
// trunk came from.

import * as THREE from 'three';
import { windUniforms, WIND_DIR } from './wind.js';

// Deterministic PRNG (LCG), matching world.js: every tree must be identical
// on every load or the corridor-clearance reasoning means nothing.
function makeLcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Bark stiffens toward the trunk; moss hangs loose and whips. aFlex scales
// each vertex's response to the wind so one mesh can carry both.
const FLEX_BARK = 1;
const FLEX_MOSS = 3.4;

// A mutable vertex buffer the limb and moss builders append into.
function makeBuilder() {
  return {
    position: [], normal: [], color: [], aHeight: [], aFlex: [], aPhase: [], index: [],
    get count() { return this.position.length / 3; },
  };
}

// Two vectors perpendicular to `dir`, forming a frame to sweep rings around.
// `ref` is carried between segments so the frame does not spin as the limb
// curves (a fresh arbitrary perpendicular each ring would twist the tube).
function frame(dir, ref) {
  const side = new THREE.Vector3().crossVectors(ref, dir);
  if (side.lengthSq() < 1e-6) {
    // dir became parallel to ref; any perpendicular will do to recover.
    side.crossVectors(new THREE.Vector3(1, 0, 0), dir);
    if (side.lengthSq() < 1e-6) side.crossVectors(new THREE.Vector3(0, 0, 1), dir);
  }
  side.normalize();
  const up = new THREE.Vector3().crossVectors(dir, side).normalize();
  return { side, up };
}

// One tapered, curving limb, swept as rings of `radial` vertices.
// Returns the tip position and direction so a caller can fork from it.
function addLimb(b, {
  origin, dir, length, radius, tipRadius, segments, radial,
  bend, gnarl, phase, rand, totalHeight, barkRoot, barkTip,
}) {
  const pos = origin.clone();
  const heading = dir.clone().normalize();
  let ref = new THREE.Vector3(0, 1, 0);
  if (Math.abs(heading.y) > 0.95) ref = new THREE.Vector3(1, 0, 0);

  const step = length / segments;
  const color = new THREE.Color();

  for (let s = 0; s <= segments; s++) {
    const t = s / segments;
    const r = radius + (tipRadius - radius) * t;
    const { side, up } = frame(heading, ref);
    ref = up;

    const ringStart = b.count;

    for (let k = 0; k < radial; k++) {
      const a = (k / radial) * Math.PI * 2;
      // Bark is not a smooth cylinder. A little per-vertex noise on the
      // radius is what separates a tree limb from a piece of pipe.
      const knot = 1 + (rand() - 0.5) * gnarl;
      const nx = side.x * Math.cos(a) + up.x * Math.sin(a);
      const ny = side.y * Math.cos(a) + up.y * Math.sin(a);
      const nz = side.z * Math.cos(a) + up.z * Math.sin(a);
      b.position.push(pos.x + nx * r * knot, pos.y + ny * r * knot, pos.z + nz * r * knot);
      // Exact radial normal: cheaper and cleaner than averaging faces after
      // the fact, and it keeps the moss normals below independent.
      b.normal.push(nx, ny, nz);
      color.copy(barkRoot).lerp(barkTip, t);
      b.color.push(color.r, color.g, color.b);
      b.aHeight.push(Math.min(Math.max((pos.y + ny * r) / totalHeight, 0), 1));
      b.aFlex.push(FLEX_BARK);
      b.aPhase.push(phase);
    }

    if (s > 0) {
      const prev = ringStart - radial;
      for (let k = 0; k < radial; k++) {
        const k2 = (k + 1) % radial;
        b.index.push(prev + k, ringStart + k, prev + k2);
        b.index.push(prev + k2, ringStart + k, ringStart + k2);
      }
    }

    // Advance, curving as we go: limbs reach up and out, never straight.
    //
    // Guarded so the LAST ring is not stepped past. Without the guard `pos`
    // ends one full segment beyond the final ring, and since that is what is
    // returned as the tip, every child limb forked from a point floating in
    // mid-air above its parent -- a visible gap between the trunk and the
    // crown, and moss hanging from nothing.
    if (s < segments) {
      pos.addScaledVector(heading, step);
      heading.x += bend.x * step + (rand() - 0.5) * gnarl * 0.35;
      heading.y += bend.y * step + (rand() - 0.5) * gnarl * 0.2;
      heading.z += bend.z * step + (rand() - 0.5) * gnarl * 0.35;
      heading.normalize();
    }
  }

  // The tip is the centre of the final ring, and tipRadius is its radius, so
  // a child limb starting here begins exactly where this one ends.
  return { tip: pos, heading, tipRadius };
}

// A hanging curtain of Spanish moss: a tapered strip that falls from a limb,
// drifting as it descends. Opaque geometry rather than an alpha-cut texture,
// for the same reason the grass blades are (no sorting, no aliasing, early-Z
// intact).
function addMoss(b, { anchor, length, width, segments, phase, rand, totalHeight, mossTop, mossTip }) {
  const drift = new THREE.Vector3((rand() - 0.5) * 0.5, 0, (rand() - 0.5) * 0.5);
  const side = new THREE.Vector3(drift.z, 0, -drift.x);
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
  side.normalize();
  const color = new THREE.Color();
  const first = b.count;

  for (let s = 0; s <= segments; s++) {
    const t = s / segments;
    // Strands hang nearly straight but swing out as they fall, and taper to
    // wisps rather than ending in a squared-off edge.
    const halfW = (width * (1 - t ** 1.5)) / 2;
    const y = anchor.y - length * t;
    const x = anchor.x + drift.x * t * t;
    const z = anchor.z + drift.z * t * t;

    b.position.push(x - side.x * halfW, y, z - side.z * halfW);
    b.position.push(x + side.x * halfW, y, z + side.z * halfW);
    // Tilted well toward +Y so the curtain gathers moonlight from above
    // instead of going black edge-on, exactly as the grass blades do.
    for (let i = 0; i < 2; i++) b.normal.push(side.z * 0.3, 0.9, -side.x * 0.3);
    color.copy(mossTop).lerp(mossTip, t);
    for (let i = 0; i < 2; i++) {
      b.color.push(color.r, color.g, color.b);
      b.aHeight.push(Math.min(Math.max(y / totalHeight, 0), 1));
      // Moss swings far more than the limb it hangs from, and more the
      // further down the strand it is.
      b.aFlex.push(FLEX_MOSS * (0.35 + t));
      b.aPhase.push(phase);
    }

    if (s > 0) {
      const a = first + (s - 1) * 2;
      b.index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
}

/**
 * Spanish moss on its own, as a curtain geometry to hang on a tree that does
 * not come with any — which is every tree model there is. Moss is the single
 * most identifiable thing about a southern live oak and no general-purpose
 * oak asset ships it, so it stays procedural even now that the tree itself
 * is a real model.
 *
 * `anchors` are points in the target's local space, normally sampled from the
 * tree's own foliage geometry so the moss hangs off real branches rather than
 * off guessed coordinates.
 */
export function buildMossCurtains(anchors, {
  seed = 0x11055,
  length = 1.6,
  width = 0.13,
  segments = 3,
  totalHeight = 7,
  // No strand may hang below this. The camera rides the path at ~1.5m eye
  // height, and moss descending past it would smear across the whole frame
  // -- the crowns are MEANT to overhang the path, which only works while
  // nothing actually reaches the lens.
  minBottomY = 2.3,
  mossTop = '#6f7663',
  mossTip = '#949a80',
} = {}) {
  const rand = makeLcg(seed);
  const b = makeBuilder();
  const mossTopC = new THREE.Color(mossTop);
  const mossTipC = new THREE.Color(mossTip);

  for (const a of anchors) {
    // Clamped per strand rather than globally, so moss on a high branch still
    // gets to hang its full length while a low one is trimmed.
    const wanted = length * (0.45 + rand() * 0.95);
    const allowed = Math.max(a[1] - minBottomY, 0);
    const strand = Math.min(wanted, allowed);
    // A stub shorter than this reads as debris stuck to a branch.
    if (strand < 0.25) continue;
    addMoss(b, {
      anchor: new THREE.Vector3(a[0], a[1], a[2]),
      length: strand,
      width: width * (0.7 + rand() * 0.7),
      segments,
      phase: rand() * Math.PI * 2,
      rand,
      totalHeight,
      mossTop: mossTopC,
      mossTip: mossTipC,
    });
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(b.position, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.normal, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(b.color, 3));
  geo.setAttribute('aHeight', new THREE.Float32BufferAttribute(b.aHeight, 1));
  geo.setAttribute('aFlex', new THREE.Float32BufferAttribute(b.aFlex, 1));
  geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(b.aPhase, 1));
  geo.setIndex(b.index);
  geo.computeBoundingBox();
  return geo;
}

/**
 * Builds one complete swamp tree as a single merged BufferGeometry: bark and
 * moss together, so a tree is one draw call.
 *
 * Base sits at y=0. Attributes: position, normal, color, aHeight, aFlex,
 * aPhase — the last three drive applyBranchSway().
 */
export function buildSwampTree({
  height = 7,
  seed = 0x53a1c7,
  levels = 3,
  moss = 34,
  mossLength = 1.5,
  barkRoot = '#221d18',
  barkTip = '#3d352b',
  mossTop = '#6f7663',
  mossTip = '#949a80',
  trunkLean = 0.12,
} = {}) {
  const rand = makeLcg(seed);
  const b = makeBuilder();
  const rootC = new THREE.Color(barkRoot);
  const tipC = new THREE.Color(barkTip);
  const mossTopC = new THREE.Color(mossTop);
  const mossTipC = new THREE.Color(mossTip);
  const mossAnchors = [];

  const trunkH = height * (0.42 + rand() * 0.08);
  const trunkR = height * 0.048;

  // --- buttress roots: short flared ribs splaying out of the base. The
  // single clearest "this grew in water" signal, and it stops the trunk
  // meeting the ground as a cylinder stuck in a plane.
  const ribs = 5 + Math.floor(rand() * 3);
  for (let i = 0; i < ribs; i++) {
    const a = (i / ribs) * Math.PI * 2 + rand() * 0.5;
    addLimb(b, {
      origin: new THREE.Vector3(0, height * 0.1, 0),
      dir: new THREE.Vector3(Math.cos(a), -1.5, Math.sin(a)),
      length: height * 0.14,
      radius: trunkR * 0.55,
      tipRadius: trunkR * 0.16,
      segments: 2,
      radial: 4,
      bend: new THREE.Vector3(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5),
      gnarl: 0.3,
      phase: 0, // roots do not move
      rand,
      totalHeight: height,
      barkRoot: rootC,
      barkTip: rootC,
    });
  }

  // --- trunk
  const lean = new THREE.Vector3((rand() - 0.5) * trunkLean, 0, (rand() - 0.5) * trunkLean);
  const trunk = addLimb(b, {
    origin: new THREE.Vector3(0, 0, 0),
    dir: new THREE.Vector3(lean.x * 0.5, 1, lean.z * 0.5),
    length: trunkH,
    // Flared at the ground, so the base swells into the buttress ribs.
    radius: trunkR * 1.9,
    tipRadius: trunkR * 0.78,
    segments: 5,
    radial: 7,
    bend: lean.clone().multiplyScalar(0.12),
    gnarl: 0.13,
    phase: rand() * Math.PI * 2,
    rand,
    totalHeight: height,
    barkRoot: rootC,
    barkTip: tipC,
  });

  // --- crown: limbs forking off limbs, thinning as they go.
  function fork(origin, heading, length, radius, depth) {
    const children = depth === levels ? 3 + Math.floor(rand() * 2) : 2 + Math.floor(rand() * 2);
    for (let i = 0; i < children; i++) {
      const a = (i / children) * Math.PI * 2 + rand() * 1.1;
      // Each generation reaches further out and less up — the spreading,
      // top-heavy silhouette of a live oak rather than a conifer's spire.
      // Tuned against the measured bounding box: the first pass reached
      // `out` 1.5 by the outer limbs and produced a tree 7.8m wide and only
      // 4.5m tall, which is a bush.
      const out = 0.32 + (levels - depth) * 0.2 + rand() * 0.28;
      const dir = new THREE.Vector3(
        heading.x + Math.cos(a) * out,
        heading.y * (0.85 - (levels - depth) * 0.11) + rand() * 0.2,
        heading.z + Math.sin(a) * out,
      ).normalize();

      const len = length * (0.6 + rand() * 0.22);
      // `radius` is the parent's TIP radius, so a child slightly thinner than
      // that reads as a fork. Much thinner and the junction shows as a step.
      const rad = radius * (0.76 + rand() * 0.14);
      const phase = rand() * Math.PI * 2;
      const limb = addLimb(b, {
        origin: origin.clone(),
        dir,
        length: len,
        radius: rad,
        tipRadius: rad * 0.55,
        segments: depth > 1 ? 3 : 2,
        radial: depth > 1 ? 5 : 4,
        // Limbs sag under their own weight as they reach out, then the tips
        // lift — the crook that makes an old tree look old.
        bend: new THREE.Vector3(Math.cos(a) * 0.14, -0.2 + rand() * 0.22, Math.sin(a) * 0.14),
        gnarl: 0.34 + rand() * 0.2,
        phase,
        rand,
        totalHeight: height,
        barkRoot: tipC,
        barkTip: tipC,
      });

      // Moss hangs off the outer limbs, where it would actually catch.
      if (depth <= 2) mossAnchors.push({ point: limb.tip.clone(), phase });

      // Grandchildren fork from this limb's TIP radius, not its base. Passing
      // the base meant every generation started thicker than the branch it
      // grew out of, so each junction bulged instead of tapering.
      if (depth > 1) fork(limb.tip, limb.heading, len, limb.tipRadius, depth - 1);
    }
  }
  fork(trunk.tip, trunk.heading, trunkH * 0.85, trunkR * 0.78, levels);

  // --- Spanish moss, hung from the anchors the crown collected.
  for (let i = 0; i < moss && mossAnchors.length; i++) {
    const a = mossAnchors[Math.floor(rand() * mossAnchors.length)];
    addMoss(b, {
      anchor: a.point.clone().add(new THREE.Vector3(
        (rand() - 0.5) * 0.35, -0.05, (rand() - 0.5) * 0.35,
      )),
      length: mossLength * (0.45 + rand() * 0.95),
      width: 0.1 + rand() * 0.13,
      segments: 3,
      phase: a.phase + rand() * 0.8,
      rand,
      totalHeight: height,
      mossTop: mossTopC,
      mossTip: mossTipC,
    });
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(b.position, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.normal, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(b.color, 3));
  geo.setAttribute('aFlex', new THREE.Float32BufferAttribute(b.aFlex, 1));
  geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(b.aPhase, 1));
  geo.setIndex(b.index);

  // Sit the tree on the ground (its buttress roots dip below the origin they
  // splay from) and scale it so `height` is EXACT rather than whatever the
  // branching happened to accumulate. Growth is a chain of random lengths and
  // angles, so the raw result drifts by metres between seeds — and callers
  // place these against a camera at eye height and a measured road corridor,
  // where "about seven metres" is not good enough.
  geo.computeBoundingBox();
  const raw = geo.boundingBox;
  geo.translate(0, -raw.min.y, 0);
  geo.scale(height / (raw.max.y - raw.min.y), height / (raw.max.y - raw.min.y), height / (raw.max.y - raw.min.y));

  // aHeight is recomputed from the FINAL positions, so it is a true 0..1 ramp
  // whatever the scaling did. Computing it during growth (against a nominal
  // height the tree never actually reached) left the crown short of full sway.
  geo.computeBoundingBox();
  const pos = geo.getAttribute('position');
  const top = Math.max(geo.boundingBox.max.y, 1e-4);
  const heights = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    heights[i] = Math.min(Math.max(pos.getY(i) / top, 0), 1);
  }
  geo.setAttribute('aHeight', new THREE.BufferAttribute(heights, 1));
  return geo;
}

// Wind for a procedural tree.
//
// Unlike the GLB version in world.js, this reads real per-vertex attributes,
// so each limb carries its own phase and the moss its own flex. The tree
// moves as a system of parts rather than rocking as one rigid body, which is
// the difference between a tree in wind and a signpost in wind.
//
// Shares uWind with the grass and the pines, so a gust crosses the whole
// scene at once.
export function applyBranchSway(material, {
  amount = 0.05, speed = 0.21, rotY = 0, mirror = false, origin = [0, 0], dir = WIND_DIR,
} = {}) {
  // The shader runs in the tree's local space, under this object's Y
  // rotation, so the world wind direction is converted on the CPU once
  // rather than per vertex.
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  let lx = dir[0] * c - dir[1] * s;
  const lz = dir[0] * s + dir[1] * c;
  if (mirror) lx = -lx;
  const travel = origin[0] * dir[0] + origin[1] * dir[1];

  // three.js keys its program cache on onBeforeCompile.toString(), which is
  // identical for every call here — only the baked literals differ, so they
  // have to go in the key explicitly. Everything per-tree is a uniform, so
  // all the trees still share one compiled program.
  material.customProgramCacheKey = () => `branchsway:${amount}:${speed}`;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = windUniforms.uWind;
    shader.uniforms.uSwayDir = { value: new THREE.Vector2(lx, lz) };
    shader.uniforms.uSwayTravel = { value: travel };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uWind;
        uniform vec2 uSwayDir;
        uniform float uSwayTravel;
        attribute float aHeight;
        attribute float aFlex;
        attribute float aPhase;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float t = uWind * ${speed.toFixed(3)} - uSwayTravel * 0.45 + aPhase;
          float gust = sin(t) + 0.35 * sin(t * 2.3 + 1.1);
          float swell = 0.6 + 0.4 * sin(uWind * 0.11 - uSwayTravel * 0.08);
          // Height squared hinges the motion at the root; aFlex then lets
          // the moss swing several times as far as the limb holding it.
          float bend = aHeight * aHeight * aFlex * gust * swell * ${amount.toFixed(4)};
          transformed.x += bend * uSwayDir.x;
          transformed.z += bend * uSwayDir.y;
          // Swinging moss hangs shorter, the same arc-length correction the
          // grass blades use.
          transformed.y -= abs(bend) * aHeight * 0.2;
        }`);
  };
  material.needsUpdate = true;
}
