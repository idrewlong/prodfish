// Split out of world.js, which had grown past 2,200 lines. Everything that grows on the ground: the tuft
// geometry a blade of grass is built from, the instanced placement that
// scatters it, and the vertex sway shared with the pines and reeds.
//
// Imports the heightfield from ground.js so grass sits on the terrain and
// stays out of the water; nothing here is imported back by ground.js.


import * as THREE from 'three';
import { positionAt } from './path.js';
import { windUniforms } from './wind.js';
import { makeLcg } from './rng.js';
import { PROP_SPOTS } from './spots.js';
import { groundHeightAt, poolShapes, WATER_LEVEL } from './ground.js';


// One instanced TUFT: a handful of individually modelled blades sharing a
// root, base pinned at y=0.
//
// This replaces a pair of crossed quads carrying a 32px canvas texture of
// painted-on blades. Four things were wrong with that, and all four are the
// same class of problem — the grass was a picture of grass rather than
// grass:
//   - the silhouette was a RECTANGLE. Whatever the texture painted, the
//     shape the eye tracked against the fog was a hard-edged box, and at
//     32px the alpha cutout's edges were visibly stair-stepped.
//   - it used MeshBasicMaterial, which is UNLIT. The field did not react to
//     the moon, the door glow or the lightning at all, so it read as a flat
//     decal pasted over a lit scene — the single biggest tell.
//   - every tuft was the same two quads at a different yaw, so the field
//     had one silhouette repeated a thousand times.
//   - alphaTest forces the GPU to give up early-Z. Real tapered geometry is
//     opaque, so this is also CHEAPER per pixel despite having more
//     triangles, which is the trade that matters on a phone.
//
// Blades taper to a point, lean off the root, and curve over under their own
// weight, with per-blade colour from root to tip. No texture, no transparency.
export function buildTuftGeometry({
  blades = 5,
  segments = 5,
  height = 0.7,
  width = 0.045,
  curve = 0.35,
  spread = 0.06,
  rootColor = '#2a3020',
  tipColor = '#7c8560',
  seed = 0x1234abcd,
} = {}) {
  const rand = makeLcg(seed);
  const root = new THREE.Color(rootColor);
  const tip = new THREE.Color(tipColor);

  const positions = [];
  const normals = [];
  const colors = [];
  const heights = []; // 0..1 up the blade, drives the wind bend
  const phases = [];  // per-blade, so blades in one tuft never move in lockstep
  const index = [];

  for (let b = 0; b < blades; b++) {
    // Splay the blades around the root rather than stacking them on one axis.
    const yaw = (b / blades) * Math.PI * 2 + rand() * 0.9;
    const dirX = Math.cos(yaw);
    const dirZ = Math.sin(yaw);
    // `height` is a true CEILING, not a nominal value: buildGrass multiplies
    // it by a per-instance vertical scale, and the blades' own variation must
    // not push a tuft past the height its caller asked for. Raggedness across
    // the field comes from that instance scale; this is only the raggedness
    // WITHIN one clump.
    const h = height * (0.6 + rand() * 0.4);
    const lean = curve * (0.4 + rand() * 1.2);
    const w = width * (0.7 + rand() * 0.7);
    const baseX = dirX * spread * rand();
    const baseZ = dirZ * spread * rand();
    const phase = rand() * Math.PI * 2;
    // Dead grass is not one colour: some blades are further gone than others.
    const dryness = 0.75 + rand() * 0.5;

    const first = positions.length / 3;
    for (let s = 0; s <= segments; s++) {
      const v = s / segments;
      // Taper to an actual point. The exponent keeps the blade full for most
      // of its length and narrows sharply near the tip, like a real leaf.
      const halfW = (w * (1 - v ** 1.6)) / 2;
      // Bend over: quadratic in height, so the root stays planted and the
      // droop accumulates toward the tip.
      const drop = lean * v * v;
      const x = baseX + dirX * drop;
      const z = baseZ + dirZ * drop;
      // A bent blade is shorter than a straight one; without this the blade
      // appears to grow as it curves.
      const y = h * v * (1 - 0.18 * v * v);

      // Perpendicular to the blade's facing, in the ground plane.
      const px = -dirZ * halfW;
      const pz = dirX * halfW;
      positions.push(x - px, y, z - pz, x + px, y, z + pz);

      // The true face normal points sideways out of a near-vertical strip, so
      // half the blades in the field would face away from the moon and go
      // black. Tilting the normal hard toward +Y makes the whole field
      // gather sky and moonlight coherently — the standard grass cheat, and
      // the difference between a lit field and a field of dark slivers.
      const n = new THREE.Vector3(dirX * 0.35, 1, dirZ * 0.35).normalize();
      normals.push(n.x, n.y, n.z, n.x, n.y, n.z);

      const c = root.clone().lerp(tip, v ** 0.8).multiplyScalar(dryness);
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
      heights.push(v, v);
      phases.push(phase, phase);

      if (s > 0) {
        const a = first + (s - 1) * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('aHeight', new THREE.Float32BufferAttribute(heights, 1));
  geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
  geo.setIndex(index);
  return geo;
}

// Tall unkempt grass tufts scattered across the field/graveyard, avoiding
// the dirt road corridor (>=1.2m clearance) so the path stays legible, and
// weighted denser around the grave spots per the Ghost-Rider reference.
export function buildGrass(scene, count, tier = 'high') {
  if (!count) return;
  const rand = makeLcg(0x9e3779b1);
  const pathSamples = [];
  for (let i = 0; i <= 80; i++) pathSamples.push(positionAt(i / 80));
  const graveXZ = PROP_SPOTS.graves.map(([x, z]) => [x, z]);
  // Field grass does not grow in standing water. This loop predates the
  // ponds and only ever rejected on distance from the ROAD, so 3.3% of the
  // tufts were being planted inside them -- standing on the bed 0.73m under
  // the surface, with the submerged three-quarters of every blade showing
  // through. Reeds are the plant that belongs in the water, and they are
  // placed separately (see buildSwamp).
  const ponds = poolShapes();

  const detail = tier === 'low'
    ? { blades: 3, segments: 3 }
    : { blades: 6, segments: 5 };
  const geo = buildTuftGeometry({
    ...detail,
    height: 0.7,
    curve: 0.34,
    // Long dead in patches, still green at the roots: the Ghost-Rider
    // graveyard field, not a lawn.
    rootColor: '#242b1a',
    tipColor: '#7b8259',
  });
  // Lit, not MeshBasic. Lambert is the cheapest material that responds to
  // the moon, the hemisphere fill and the red spill from the doorway — which
  // is the whole reason the field now sits IN the scene rather than on top of
  // it. Vertex colours carry the root-to-tip gradient, so the material's own
  // colour stays white and multiplies cleanly.
  const mat = new THREE.MeshLambertMaterial({
    color: '#ffffff',
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  applySway(mat, { amount: 0.075, speed: 0.55 });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.name = 'grassField';
  const dummy = new THREE.Object3D();
  const clusterCount = Math.floor(count * 0.45);
  let placed = 0;
  let attempts = 0;
  const maxAttempts = count * 25;
  while (placed < count && attempts < maxAttempts) {
    attempts++;
    let x;
    let z;
    if (placed < clusterCount) {
      const g = graveXZ[Math.floor(rand() * graveXZ.length)];
      x = g[0] + (rand() - 0.5) * 4.5;
      z = g[1] + (rand() - 0.5) * 4.5;
    } else {
      x = (rand() - 0.5) * 20;
      z = 2 + rand() * 44;
    }
    // Clearance from the camera/road corridor. Raised from 1.2m because a
    // modelled tuft is genuinely WIDER than the old 0.5m crossed quad -- the
    // blades lean and droop out to ~0.55m from the root before the
    // per-instance horizontal scale, against a road half-width of ~1.0m. At
    // 1.2m the drooping tips reached into the wheel ruts.
    const CLEARANCE = 1.45;
    let minD = Infinity;
    for (const p of pathSamples) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < minD) minD = d;
      if (minD < CLEARANCE) break;
    }
    if (minD < CLEARANCE) continue;
    // Out of the ponds, and off the waterline itself: a tuft standing exactly
    // at the shore is still half under, which looks no better than one in the
    // middle. groundHeightAt is the same terrain the tuft would be planted
    // on, so anything already below the waterline is in the water.
    if (groundHeightAt(x, z, ponds) < WATER_LEVEL + 0.06) continue;
    // Height varies far more than it used to (0.55x to 1.9x rather than a
    // flat 0.4-0.9m band): unmown grass around graves grows in uneven clumps,
    // and a uniform height was as much of a tell as the flat shading was.
    const tuftH = 0.55 + rand() * rand() * 1.35;
    dummy.position.set(x, groundHeightAt(x, z), z);
    dummy.rotation.set(
      // A slight lean off vertical, so no two tufts stand to attention.
      (rand() - 0.5) * 0.22,
      rand() * Math.PI * 2,
      (rand() - 0.5) * 0.22,
    );
    dummy.scale.set(0.8 + rand() * 0.5, tuftH, 0.8 + rand() * 0.5);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
}




// Wind. Both the graveyard grass and the swamp reeds are instanced blades, so
// bending them per-instance on the CPU would mean rewriting every matrix
// every frame. Instead the material's vertex shader bends each blade by its
// own height above the ground -- roots stay put, tips move -- driven by one
// shared uniform. Cost is a few instructions per vertex.
//
// The uniform itself now lives in wind.js, because the procedural trees need
// it too and importing it from here would be a cycle.

// Wind that TRAVELS. The previous version drove every blade off a seed
// derived from its own position with no spatial term, so the entire field
// oscillated as one body — the giveaway that it was a shader effect rather
// than weather. Subtracting a term proportional to distance along the wind
// direction turns the same sine into a wave that crosses the graveyard, and
// a slow swell on top means the gusts arrive in breaths instead of at one
// constant strength.
// Exported for testing: a syntax error in this injected GLSL fails the whole
// scene to a black screen at runtime, and there is no compiler in the test
// environment to catch it, so the generated source is asserted directly.
export function applySway(material, { amount, speed, dir = [0.82, 0.57] } = {}) {
  // three.js keys its compiled-program cache on `onBeforeCompile.toString()`,
  // which returns the function's SOURCE TEXT -- with `${amount}` and
  // `${speed}` still unevaluated. Every material passing through here
  // therefore produces a byte-identical key, so the grass and the reeds (very
  // different amount/speed) silently shared whichever program compiled first.
  // Folding the actual values into the key is what makes them distinct.
  material.customProgramCacheKey = () => `sway:${amount}:${speed}:${dir.join(',')}`;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = windUniforms.uWind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uWind;
        attribute float aHeight;
        attribute float aPhase;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec3 windDir = vec3(${dir[0].toFixed(3)}, 0.0, ${dir[1].toFixed(3)});
          #ifdef USE_INSTANCING
            vec3 iPos = instanceMatrix[3].xyz;
            // transformed is still in the tuft's LOCAL space here --
            // instancing is applied later, in project_vertex. Every tuft
            // carries a random yaw, so bending along a fixed local axis would
            // rotate the wind with each tuft and the field would splay in all
            // directions instead of leaning together. Projecting the world
            // wind direction onto the instance's own (normalized, so
            // per-instance scale drops out) axes converts it into local space,
            // which is what makes one gust cross the whole graveyard.
            vec3 iX = normalize(instanceMatrix[0].xyz);
            vec3 iZ = normalize(instanceMatrix[2].xyz);
            vec2 localDir = vec2(dot(windDir, iX), dot(windDir, iZ));
          #else
            vec3 iPos = vec3(0.0);
            vec2 localDir = windDir.xz;
          #endif
          // How far this tuft sits along the wind's line of travel: this is
          // the term that turns a synchronised oscillation into a wave.
          float travel = dot(iPos, windDir);
          float t = uWind * ${speed.toFixed(2)} - travel * 0.45 + aPhase;
          float gust = sin(t) + 0.35 * sin(t * 2.3 + 1.1);
          // Breaths: the field goes still and then picks up again.
          float swell = 0.6 + 0.4 * sin(uWind * 0.11 - travel * 0.08);
          // Quadratic in height: hinges at the root, whips at the tip.
          float bend = aHeight * aHeight * gust * swell * ${amount.toFixed(3)};
          transformed.x += bend * localDir.x;
          transformed.z += bend * localDir.y;
          // A blade bent over covers less vertical distance. Without this the
          // whole field visibly stretches taller on every gust.
          transformed.y -= abs(bend) * aHeight * 0.35;
        }`);
  };
  material.needsUpdate = true;
}

