// Split out of world.js, which had grown past 2,200 lines. The terrain the whole scene stands on: the
// swamp's pool outlines, the basin cut under each one, the heightfield every
// other placement function samples, and the water surface itself.
//
// Depends on nothing in world.js — the arrow points one way, world.js ->
// ground.js, so the heightfield can be imported by anything that needs to
// stand something on the ground.


import * as THREE from 'three';
import { positionAt } from './path.js';
import { windUniforms } from './wind.js';
import { makeLcg } from './rng.js';
import { PROP_SPOTS, WATCHER_SPOTS } from './spots.js';


// ---------------------------------------------------------------- swamp ---
// Low wet country around the monument row on the scenic road. Deliberately
// far from the church so the two places read as different countries. This
// reuses the graveyard's own grass geometry and placement helpers with
// swampier parameters rather than introducing a second vegetation system.
export const SWAMP_CENTRE = [0, 30];
export const SWAMP_RADIUS = 17;

// Standing water, as pools FLANKING the causeway rather than one disc laid
// over it.
//
// The pool used to be a single CircleGeometry of radius 17 centred at [0,30]
// -- straight through the middle of the road. 59% of the camera path ran
// inside it and it passed within 1.79m of the centre, so the visitor walked
// the length of a flooded track with the dirt ribbon floating on top of the
// water rather than beside it. Two pools set either side is both what the
// complaint asks for and what low country actually looks like: a raised
// causeway with water on both hands.
// Two SMALL ponds, sited in the only real gaps in the graveyard.
//
// The first attempt at this put an 8.5m and a 7.5m pool at [-9.5,31] and
// [10.5,24] on the strength of their distance from the ROAD alone. Nothing
// checked them against the props, and they turned out to swallow 8
// gravestones, 5 trees and 3 of the watchers -- markers standing in open
// water and trees growing out of a pond. The graveyard is dense enough near
// the path that there is no room for anything bigger than this: measured, the
// widest genuinely open ground within sight of the road is ~6.9m across.
export const POOLS = [
  { centre: [-12.25, 16], radius: 5.1, seed: 0x9a7e01 },
  { centre: [12.25, 37.5], radius: 5.3, seed: 0x9a7e02 },
];

// Everything a pond must not drown. Kept as a function because the spots are
// defined further down the file.
function poolObstacles() {
  return [
    ...PROP_SPOTS.graves.map(([x, z]) => [x, z, 1.9]),
    ...PROP_SPOTS.trees.map(([x, z]) => [x, z, 2.6]),
    ...WATCHER_SPOTS.map(([x, z]) => [x, z, 1.6]),
  ];
}

// One pool's shoreline, as a closed polygon.
//
// A circle is the single biggest tell that water is a primitive, so the
// radius wanders on three octaves. Every point is then pulled inward until it
// is at least `margin` from the camera corridor, which is what guarantees the
// road stays dry no matter how the outline is retuned. Pulling along the ray
// from the centre keeps the polygon star-shaped, so the fan triangulation
// below stays valid.
export function poolOutline({ centre, radius, seed, samples = 60, margin = 2.4 }) {
  const rand = makeLcg(seed);
  const p1 = rand() * Math.PI * 2;
  const p2 = rand() * Math.PI * 2;
  const p3 = rand() * Math.PI * 2;
  const path = [];
  for (let i = 0; i <= 120; i++) path.push(positionAt(i / 120));

  // The shoreline must clear the road AND everything standing in the field.
  // Returns how much slack a candidate point has: positive means it is clear
  // of every constraint, negative means it has already drowned something.
  //
  // Props were not part of this at first, and the ponds simply grew over
  // them -- gravestones in open water, trees growing out of a pond.
  const obstacles = poolObstacles();
  const slackAt = (a, r) => {
    const x = centre[0] + Math.cos(a) * r;
    const z = centre[1] + Math.sin(a) * r;
    let slack = Infinity;
    for (const p of path) {
      const d = Math.hypot(p.x - x, p.z - z) - margin;
      if (d < slack) slack = d;
    }
    for (const [ox, oz, keep] of obstacles) {
      const d = Math.hypot(ox - x, oz - z) - keep;
      if (d < slack) slack = d;
    }
    return slack;
  };

  // Base radius per angle, then pulled in to clear the road.
  //
  // The pull used to step down in fixed 0.3m decrements, so neighbouring
  // points could land on different steps and the bank came out visibly
  // notched -- straight faceted segments right where the shoreline should be
  // at its most organic. Binary search gives a continuous answer instead.
  const angles = [];
  const radii = [];
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2;
    const base = radius * (1
      + 0.24 * Math.sin(a * 2 + p1)
      + 0.14 * Math.sin(a * 3 + p2)
      + 0.07 * Math.sin(a * 5 + p3));

    let r = base;
    if (slackAt(a, base) < 0) {
      let lo = 0.3;
      let hi = base;
      for (let k = 0; k < 22; k++) {
        const mid = (lo + hi) / 2;
        if (slackAt(a, mid) >= 0) lo = mid;
        else hi = mid;
      }
      r = lo;
    }
    angles.push(a);
    radii.push(r);
  }

  // Smooth the shoreline, then re-clamp. Binary search removes the stepping
  // but still leaves a hard corner where the clamp starts biting; a short
  // blur rounds the transition into the bank. Re-clamping afterwards is what
  // keeps the smoothing from pushing water back over the road.
  const smoothed = radii.map((_, i) => {
    const a = radii[(i - 1 + samples) % samples];
    const b = radii[i];
    const c = radii[(i + 1) % samples];
    return a * 0.25 + b * 0.5 + c * 0.25;
  });
  for (let i = 0; i < samples; i++) {
    radii[i] = Math.min(smoothed[i], radii[i] * 1.02);
    if (slackAt(angles[i], radii[i]) < 0) {
      let lo = 0.3;
      let hi = radii[i];
      for (let k = 0; k < 22; k++) {
        const mid = (lo + hi) / 2;
        if (slackAt(angles[i], mid) >= 0) lo = mid;
        else hi = mid;
      }
      radii[i] = lo;
    }
  }

  return radii.map((r, i) => [
    +(centre[0] + Math.cos(angles[i]) * r).toFixed(3),
    +(centre[1] + Math.sin(angles[i]) * r).toFixed(3),
  ]);
}

// Scum, silt and duckweed on standing water. Drawn once to a canvas and
// tiled: the surface needs to look like something is floating on it, which
// is what separates swamp water from a mirror.
// One tile of water surface, WATER_TILE metres square.
//
// Sizing note: this used to be a 256px canvas repeated 6x across a 17m pool,
// which works out at 90 pixels per metre -- roughly half the density of the
// church's textures on comparable features, and the reason the surface read
// as low resolution. 512px over a 3m tile is 171 px/m, and because the UVs
// are now in WORLD space (see buildPool) that density is identical on every
// pool regardless of its size, instead of stretching with the radius.
const WATER_TILE = 3;

// How deep the basin under each pool is cut, and where the water sits in it.
//
// The pools were previously a flat plane laid on flat ground: the shoreline
// was a 2D line with nothing behind it, so however well the surface waved it
// read as paper on a table. There is no shader fix for that, because the
// missing cue is in the TERRAIN -- water in a hollow reads as water because
// you can see the bank falling away into it.
export const BASIN_DEPTH = 0.85;
// The surface sits below the surrounding field by MORE than the waves are
// tall. At -0.12 with the enlarged waves (+/-0.164m) the crests reached
// +0.044m -- above the field -- so the pond climbed over its own bank and
// washed across the grass, while between crests the bed poked back through
// near the shore. The waterline is wherever the basin crosses this height,
// which leaves the polygon's own edge buried in the bank and no hard rim.
export const WATER_LEVEL = -0.28;
// How far out the bank slopes up to meet the field.
const BASIN_MARGIN = 2.6;

// Cached because both the ground (which needs the shapes to carve itself) and
// the pools (which are built from them) ask for the same outlines, and each
// one costs a full sweep of the camera path per sample.
let poolShapeCache = null;

export function poolShapes() {
  if (!poolShapeCache) {
    poolShapeCache = POOLS.map((p) => ({ ...p, outline: poolOutline({ ...p, samples: 96 }) }));
  }
  return poolShapeCache;
}

// The outline's radius at an arbitrary angle, interpolated between samples.
function outlineRadiusAt(shape, angle) {
  const { outline, centre } = shape;
  const n = outline.length;
  const a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const f = (a / (Math.PI * 2)) * n;
  const i0 = Math.floor(f) % n;
  const i1 = (i0 + 1) % n;
  const t = f - Math.floor(f);
  const r0 = Math.hypot(outline[i0][0] - centre[0], outline[i0][1] - centre[1]);
  const r1 = Math.hypot(outline[i1][0] - centre[0], outline[i1][1] - centre[1]);
  return r0 + (r1 - r0) * t;
}

// Ground height at a world point: 0 across the field, dipping into a basin
// under each pool. Exported so anything standing on the ground (reeds,
// boulders) can sit on it rather than hovering at y=0 over a hollow.
let groundPathSamples = null;

export function groundHeightAt(x, z, shapes = poolShapes()) {
  let drop = 0;
  for (const shape of shapes) {
    const dx = x - shape.centre[0];
    const dz = z - shape.centre[1];
    const dist = Math.hypot(dx, dz);
    const rOut = outlineRadiusAt(shape, Math.atan2(dz, dx));
    const rim = rOut + BASIN_MARGIN;
    if (dist >= rim) continue;
    // Full depth by 60% of the way in, so the bed is dished rather than a
    // flat-bottomed tub with a step at the waterline.
    const inner = rOut * 0.6;
    const t = Math.min(Math.max((rim - dist) / (rim - inner), 0), 1);
    drop = Math.max(drop, BASIN_DEPTH * (t * t * (3 - 2 * t)));
  }
  if (drop === 0) return 0;

  // The road is a flat ribbon laid at y=0.012; if a basin's outer slope
  // reached under it the road would hang in the air over a dip. This fade
  // lives HERE rather than in the ground builder so that the terrain mesh and
  // everything standing on it are derived from one definition of ground
  // height -- when the mesh had its own version, props sat at the uncarved
  // height and floated over the dip.
  if (!groundPathSamples) {
    groundPathSamples = [];
    for (let i = 0; i <= 140; i++) groundPathSamples.push(positionAt(i / 140));
  }
  let nearPath = Infinity;
  for (const p of groundPathSamples) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < nearPath) nearPath = d;
  }
  const keep = Math.min(Math.max((nearPath - 1.6) / 1.4, 0), 1);
  return -drop * keep * keep * (3 - 2 * keep);
}

export function makeWaterTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#16211c';
  ctx.fillRect(0, 0, size, size);

  const rand = makeLcg(0x51117e2);

  // Everything is drawn nine times, once per neighbouring tile offset, so
  // marks crossing an edge reappear on the far side. The old texture was
  // drawn without wrapping, which put a visible grid of seams across the
  // pool as soon as it tiled more than once or twice.
  const wrapped = (draw) => {
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) draw(ox * size, oy * size);
    }
  };

  // Silt mottling: broad, soft, low contrast.
  for (let i = 0; i < 100; i++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const r = 23 + rand() * 80;
    const alpha = 0.05 + rand() * 0.08;
    const fill = rand() > 0.5 ? '#24322a' : '#0e1613';
    wrapped((dx, dy) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Duckweed: small green flecks gathered in drifts. Radius is set from the
  // new density so each fleck stays the same ~1-2cm across in world terms.
  for (let i = 0; i < 1000; i++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const r = 1.3 + rand() * 1.7;
    const fill = rand() > 0.35 ? '#2c3d26' : '#374b2e';
    const alpha = 0.25 + rand() * 0.5;
    wrapped((dx, dy) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  // The UVs carry the tiling now, so this stays 1:1.
  tex.repeat.set(1, 1);
  tex.anisotropy = 8; // the surface is viewed at a very grazing angle
  return tex;
}

// Builds one pool's surface from its outline: a triangle fan from the centre,
// with the shoreline darkened through vertex colours so the water shallows
// into the bank instead of ending at a hard rim like a sticker laid on the
// ground. That hard edge is most of what made the old disc read as a
// primitive, along with its perfectly circular outline.
// The ground, as a radial grid dished into a basin under each pool.
//
// Built in the XZ plane directly (not rotated into place like the old
// CircleGeometry) so the basin carving can be expressed in world coordinates
// and groundHeightAt() means the same thing here as it does everywhere else.
export function buildGroundGeometry(settings = { groundStep: 0.7 }) {
  // A NON-UNIFORM XZ GRID, fine across the scene and coarse out to the fog.
  //
  // This was a radial grid centred on the world origin, and that is the wrong
  // shape for the job: angular resolution falls off with distance, so a pond
  // 40m out got 2.9 x 1.6 vertices across it on the low tier -- no basin was
  // carved at all, the ground stayed flat at y=0, and the water sitting at
  // -0.28 was buried underneath it and simply vanished. A grid gives the same
  // resolution wherever the pond happens to be, which is the property this
  // actually needs, and it costs fewer vertices because it stops lavishing
  // detail on the empty middle.
  const step = settings.groundStep;
  const shapes = poolShapes();

  // Fine over everything the camera travels through, then a few coarse spans
  // out to the fog line. One grid, so there is no seam between the two.
  const axis = (fineFrom, fineTo, coarseLo, coarseHi) => {
    const out = [...coarseLo];
    for (let v = fineFrom; v <= fineTo + 1e-6; v += step) out.push(+v.toFixed(3));
    return out.concat(coarseHi);
  };
  const xs = axis(-26, 26, [-90, -60, -42, -32], [32, 42, 60, 90]);
  const zs = axis(-8, 52, [-46, -26, -15], [60, 72, 90]);

  const positions = [];
  const index = [];
  for (let iz = 0; iz < zs.length; iz++) {
    for (let ix = 0; ix < xs.length; ix++) {
      positions.push(xs[ix], groundHeightAt(xs[ix], zs[iz], shapes), zs[iz]);
    }
  }
  const w = xs.length;
  for (let iz = 0; iz < zs.length - 1; iz++) {
    for (let ix = 0; ix < w - 1; ix++) {
      const a = iz * w + ix;
      index.push(a, a + w, a + 1, a + 1, a + w, a + w + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(index);
  // Real normals, so the bank catches the moon differently from the flat
  // field and the hollow is legible as a shape rather than a colour change.
  geo.computeVertexNormals();
  return geo;
}

// Rings, not a fan.
//
// A triangle fan gives a pool exactly ONE interior vertex, and that breaks
// two things at once: the wave in applyWaterMotion displaces vertices, so
// with nothing between the centre and the rim there is nothing for it to move
// and the surface stays dead flat however good the shader is; and the
// shoreline darkening interpolates straight from the middle to the edge,
// shading the pool like a cone. Concentric rings give the interior real
// vertices to move and a shoreline that reads as a margin instead of a
// gradient across the whole pond.
const POOL_RINGS = 14;

export function buildPool({ centre, outline }) {
  const n = outline.length;
  const positions = [];
  const colors = [];
  // WORLD-space UVs: one texture tile per WATER_TILE metres, everywhere. The
  // previous mapping normalised by the pool's radius, so a bigger pool
  // stretched the same texture further and got blurrier -- texel density
  // varied with pool size instead of being a property of the water.
  const uvs = [];
  const index = [];

  // Ring 0 is the centre point, rings 1..POOL_RINGS march out to the outline.
  const shores = [];
  positions.push(centre[0], 0, centre[1]);
  colors.push(1, 1, 1);
  shores.push(1);
  uvs.push(centre[0] / WATER_TILE, centre[1] / WATER_TILE);

  for (let r = 1; r <= POOL_RINGS; r++) {
    const t = r / POOL_RINGS;
    // Only the outer quarter shallows out, so the pool reads as deep water
    // with a silty margin rather than as a cone.
    const shade = t < 0.75 ? 1 : 1 - ((t - 0.75) / 0.25) * 0.65;
    // How freely this vertex may wave: nothing at the rim, full by two
    // thirds of the way in. Shallow water carries smaller waves than open
    // water does, and damping them here is also what stops a crest lifting
    // the edge of the pond up over its bank.
    const swell = Math.min(Math.max((0.82 - t) / 0.35, 0), 1);
    for (let i = 0; i < n; i++) {
      const x = centre[0] + (outline[i][0] - centre[0]) * t;
      const z = centre[1] + (outline[i][1] - centre[1]) * t;
      positions.push(x, 0, z);
      colors.push(shade, shade, shade);
      shores.push(swell * swell * (3 - 2 * swell));
      uvs.push(x / WATER_TILE, z / WATER_TILE);
    }
  }

  const ringStart = (r) => 1 + (r - 1) * n;
  // Innermost fan, centre to ring 1.
  for (let i = 0; i < n; i++) {
    index.push(0, ringStart(1) + ((i + 1) % n), ringStart(1) + i);
  }
  // Quads between successive rings.
  for (let r = 1; r < POOL_RINGS; r++) {
    for (let i = 0; i < n; i++) {
      const a = ringStart(r) + i;
      const b = ringStart(r) + ((i + 1) % n);
      const c = ringStart(r + 1) + i;
      const d = ringStart(r + 1) + ((i + 1) % n);
      index.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('aShore', new THREE.Float32BufferAttribute(shores, 1));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

// Moving water. The old surface was rippled ONCE into the geometry and then
// never moved -- only its texture slid, which reads as a pattern drifting
// under glass rather than as a liquid. This displaces the surface every frame
// off the scene's shared clock AND rebuilds the normal analytically from the
// same wave, so the moon's highlights travel across the pool. Highlights that
// move are what actually make a flat plane read as water.
export function applyWaterMotion(material) {
  material.customProgramCacheKey = () => 'water:v3';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = windUniforms.uWind;
    shader.uniforms.uSkyTint = { value: new THREE.Color('#33425e') };

    // FRESNEL — the thing that actually makes a plane read as water.
    //
    // A surface lit only by diffuse light is equally bright wherever you
    // stand, which is why the pool read as pale paper lying on the ground no
    // matter how well it waved. Real water is nearly transparent when you
    // look straight down into it and nearly a mirror when you look across it,
    // and since the camera is at eye height that means the near water should
    // be dark and the far water should lift toward the sky. That gradient IS
    // the sense of depth; without it there is no cue for which part of the
    // surface is near.
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uSkyTint;`)
      .replace('#include <fog_fragment>', `
        {
          // vViewPosition points from the fragment to the camera, and normal
          // is in the same view space, so this is the true incidence angle.
          float cosI = clamp(dot(normalize(vViewPosition), normalize(normal)), 0.0, 1.0);
          // Schlick, weighted so grazing water lifts hard toward the sky.
          float fres = pow(1.0 - cosI, 4.0);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uSkyTint, fres * 0.78);
        }
        #include <fog_fragment>`);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uWind;
        // three declares the attributes it knows about (position, normal, uv,
        // color) in its own shader prefix and nothing else, so a custom one
        // has to be declared here. Without it the vertex shader failed to
        // compile — "'aShore' : undeclared identifier" — which took the whole
        // water program down and left the pool not drawing at all.
        // Spelled "attribute" rather than "in" on purpose: three compiles
        // this as GLSL ES 1.00 and #defines attribute -> in under WebGL2, so
        // this spelling is the one that works on both.
        // (No backticks in this comment: it lives inside a template literal.)
        attribute float aShore;
        // Amplitudes are in METRES. These were 1.6cm, 1.1cm and 0.5cm --
        // physically reasonable for a still pond and completely invisible at
        // the distances involved, which is why the surface still read as
        // flat while demonstrably moving. Ripples on real standing water in
        // wind run several centimetres, and the scene needs to SEE them.
        float waveAt(vec2 p, float t) {
          return sin(p.x * 0.62 + t * 0.55) * 0.075
               + sin(p.y * 0.94 - t * 0.43) * 0.052
               + sin((p.x + p.y) * 1.7 + t * 0.85) * 0.026
               + sin((p.x - p.y) * 3.1 - t * 1.25) * 0.011;
        }`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        {
          // Analytic derivatives of waveAt, so the normal matches the
          // displacement exactly instead of being approximated.
          vec2 p = position.xz;
          float t = uWind;
          float dx = 0.62 * 0.075 * cos(p.x * 0.62 + t * 0.55)
                   + 1.7 * 0.026 * cos((p.x + p.y) * 1.7 + t * 0.85)
                   + 3.1 * 0.011 * cos((p.x - p.y) * 3.1 - t * 1.25);
          float dz = 0.94 * 0.052 * cos(p.y * 0.94 - t * 0.43)
                   + 1.7 * 0.026 * cos((p.x + p.y) * 1.7 + t * 0.85)
                   - 3.1 * 0.011 * cos((p.x - p.y) * 3.1 - t * 1.25);
          objectNormal = normalize(vec3(-dx * 3.0 * aShore, 1.0, -dz * 3.0 * aShore));
        }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed.y += waveAt(position.xz, uWind) * aShore;`);
  };
  material.needsUpdate = true;
}
