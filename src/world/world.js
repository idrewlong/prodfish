import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { positionAt, T_DOOR } from './path.js';
import { TIERS } from '../device.js';
import { buildMossCurtains, applyBranchSway } from './trees.js';
import { windUniforms, setWind } from './wind.js';
import { makeLcg } from './rng.js';
import { PROP_SPOTS, WATCHER_SPOTS } from './spots.js';
import {
  SWAMP_CENTRE, SWAMP_RADIUS, POOLS, poolOutline, WATER_LEVEL,
  poolShapes, groundHeightAt, buildGroundGeometry,
  makeWaterTexture, buildPool, applyWaterMotion,
} from './ground.js';
import { buildTuftGeometry, buildGrass, applySway } from './groundcover.js';

// world.js stays the single public face of the world: sceneManager and the
// test suite import from here, not from the pieces it is now assembled from.
export {
  PROP_SPOTS, SWAMP_CENTRE, SWAMP_RADIUS, POOLS, poolOutline, WATER_LEVEL,
  poolShapes, groundHeightAt, buildGroundGeometry, buildTuftGeometry, applySway,
  WATCHER_SPOTS,
};
export { BASIN_DEPTH } from './ground.js';

export { setWind };

// Night sky/fog tone, shared with sceneManager.js. Deliberately NOT applied
// through ACES Filmic tone mapping for the sky dome below: at the exposure
// needed to make the graveyard/church legible (2.3), tone mapping's shadow
// "toe" crushes any near-black background color to true (0,0,0) — the void
// read as pitch-black in every approach screenshot regardless of how bright
// this constant was set. The dome sidesteps that by disabling toneMapped on
// its material, so the sky reads as a lit, hazy navy night rather than an
// empty black hole above the lit ground.
export const NIGHT_SKY = '#141d30';

// Low-tier prop thinning: keep the ~`fraction` of `spots` sitting closest to
// the camera path (by nearest-approach distance), dropping the rest. This is
// deterministic (fixed distance metric, no randomness) and never mutates
// PROP_SPOTS itself -- it only filters at placement time in buildWorld(), so
// PROP_SPOTS stays exactly as the corridor-clearance/density tests expect.
// Keeping the near-path spots (rather than, say, an arbitrary prefix of the
// array) means the props hugging the road -- what's actually legible in
// frame during the approach -- stay dressed, while the further-back "depth"
// row thins out first.
function nearestToPath(spots, fraction) {
  const scored = spots.map((spot, index) => {
    const [x, z] = spot;
    let minD = Infinity;
    for (let i = 0; i <= 60; i++) {
      const p = positionAt(i / 60);
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < minD) minD = d;
    }
    return { spot, index, minD };
  });
  scored.sort((a, b) => a.minD - b.minD);
  const keep = Math.round(spots.length * fraction);
  return scored
    .slice(0, keep)
    .sort((a, b) => a.index - b.index)
    .map((s) => s.spot);
}

// Minimum horizontal distance from any spot to the sampled camera path.
export function minPathClearance(spots) {
  let min = Infinity;
  for (const [x, z] of spots) {
    for (let i = 0; i <= 200; i++) {
      const p = positionAt(i / 200);
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < min) min = d;
    }
  }
  return min;
}

function silhouette(kind) {
  // Fallback primitive when a GLB is missing: a dark shape in the fog.
  const mat = new THREE.MeshStandardMaterial({ color: '#0c0f0d', roughness: 1 });
  if (kind === 'tree') {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.28, 4.5, 6), mat);
    trunk.position.y = 2.25;
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 2.4, 5), mat);
    limb.position.set(0.5, 3.6, 0);
    limb.rotation.z = -0.9;
    g.add(trunk, limb);
    return g;
  }
  const stone = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.16), mat);
  stone.position.y = 0.45;
  stone.rotation.x = (Math.abs(kind.length % 3) - 1) * 0.04;
  const g = new THREE.Group();
  g.add(stone);
  return g;
}

// Church model scale, in meters of building height (floor to tower-cross
// tip), chosen from the DOOR OPENING, not the overall silhouette.
//
// normalize() scales uniformly using the *whole* bounding box (tower
// included), so a naive "make the church ~9m tall" target — reasonable for
// a modest chapel silhouette — shrinks the door in the same box down to
// ~1m tall, well under the eye-height camera (LANDMARKS y≈1.5 in path.js).
// Measured empirically (task-12: raycast probes against the live church.glb
// at the old 9m target) the real door opening was ~1.0m wide x ~1.22m tall.
// 18m keeps that same ratio scaled up to ~2.0m wide x ~2.48m tall — inside
// the brief's 2.4-2.8m target band, with headroom over the ~1.5m camera.
const CHAPEL_TARGET_HEIGHT = 18;

// Non-uniform z-only stretch applied to the chapel after normalize(). At the
// corrected CHAPEL_TARGET_HEIGHT the model's native depth (~10.8m) already
// covers the ~10.5m doorway-to-altar aisle (LANDMARKS DOOR z=0, ALTAR_STOP
// z=-10.5 in path.js), so no stretch is needed — kept as a named hook (1 =
// no-op) in case a future model swap needs it. See task-12-report.md.
const CHAPEL_Z_STRETCH = 1;

// A long-abandoned dirt road ribbon, hugging the camera path from the field
// (path start) up to the church door. Built from sampled path points offset
// perpendicular to the direction of travel; width wanders deterministically
// (sine-based, no Math.random) so the edges read as worn/irregular rather
// than a crisp paved band, with occasional narrow "washed-out" patches.
// The ribbon stops just shy of the doorway on whichever road it follows —
// running it through the door would lay dirt down the aisle.
export function roadEndT() {
  return Math.min(T_DOOR - 0.015, 0.98);
}

// Enough segments that the curve never facets into straight lines.
export function roadSampleCount() {
  return 140;
}

function buildRoad(scene) {
  const steps = roadSampleCount();
  const endT = roadEndT();
  const baseWidth = 2.2;
  const up = new THREE.Vector3(0, 1, 0);
  const positions = [];
  const indices = [];
  let vi = 0;
  const colors = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const t = endT * u;
    const p = positionAt(t);
    const ahead = positionAt(Math.min(t + 0.004, 1));
    const tangent = new THREE.Vector3().subVectors(ahead, p).normalize();
    const perp = new THREE.Vector3().crossVectors(up, tangent).normalize();

    // A worn track wanders slowly; it does not flicker. The previous version
    // varied width against the SEGMENT INDEX (period ~9 of 140 segments), and
    // pinched to 40% wherever `sin(i * 0.31) > 0.85` -- a hard binary cut that
    // read as random chunks bitten out of the road. Both are now smooth
    // functions of distance travelled, so the edges undulate like a path worn
    // by feet rather than like noise.
    // Straighter than before, but still a dirt path rather than a paved
    // road: one long, slow undulation with a little fine grain on top. An
    // earlier version added a bright packed "crown" down the middle, which
    // tipped it over into looking engineered.
    const wobble = Math.sin(u * Math.PI * 2) * 0.16 + Math.sin(u * Math.PI * 5 + 1.3) * 0.06;
    // Narrows gently toward the church, where the ground is firmer and the
    // traffic funnels.
    const taper = 1 - 0.22 * u;
    const halfW = ((baseWidth + wobble) * taper) / 2;

    const left = p.clone().addScaledVector(perp, -halfW);
    const right = p.clone().addScaledVector(perp, halfW);
    left.y = 0.012;
    right.y = 0.012;
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
    // Darker at the edges so the ribbon blends into the ground instead of
    // reading as a sticker laid on top of it.
    colors.push(0.45, 0.45, 0.45, 0.45, 0.45, 0.45);
    if (i > 0) {
      const a = vi - 2;
      const b = vi - 1;
      const c = vi;
      const d = vi + 1;
      indices.push(a, b, c, b, d, c);
    }
    vi += 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color: '#5a4530', roughness: 1, side: THREE.DoubleSide, vertexColors: true,
  });
  const road = new THREE.Mesh(geo, mat);
  road.name = 'roadRibbon';
  scene.add(road);
}

// Warm light from inside the church, so the building reads as occupied
// rather than derelict long before the door is reachable.
//
// An earlier version added a glowing DISC on the facade to stand in for lit
// glass. It sat at z=+0.35 while the facade's front face is at z=-0.4, so it
// floated in front of the building like a brown moon stuck to the steeple.
// There is no disc now: just light, placed inside, spilling out through the
// openings the model already has. Light cannot end up in front of a wall.
function buildWindowGlow(scene) {
  const inner = new THREE.PointLight('#ffa94d', 9, 22, 2);
  inner.position.set(0, 6.5, -3.4);
  scene.add(inner);

  // A second, tighter source behind the rose window itself, high in the
  // gable, so the tracery catches some of it from outside.
  const rose = new THREE.PointLight('#ffb45e', 5, 12, 2.2);
  rose.position.set(0, 12.4, -1.6);
  scene.add(rose);

  return { inner, rose };
}

// Mist banks: a handful of big, soft, near-horizontal sheets lying low over
// the water. Fog alone is uniform and gives no sense of depth BETWEEN
// things; these drift slowly across the road and put visible layers between
// the camera and the treeline, which is the single most low-country thing
// the scene was missing.
// Mist banks are big overlapping TRANSPARENT sheets, which is the classic
// mobile fill-rate killer: every one of them redraws a large slice of the
// screen, and they stack. Five of them is also simply too much fog on a phone
// -- on a small screen they overlap far more of the frame than they do on a
// desktop monitor, which is why the scene came out as soup. The low tier
// keeps the two furthest-reaching banks at reduced opacity.
function buildMist(scene, settings = { mist: 5, mistOpacity: 1 }) {
  const tex = makeMistTexture();
  const banks = [];
  const spec = [
    [0, 1.1, 34, 30, 0.30],
    [-9, 0.8, 24, 26, 0.24],
    [11, 1.3, 18, 24, 0.22],
    [3, 0.7, 8, 22, 0.20],
    [-6, 1.5, 44, 28, 0.18],
  ].slice(0, settings.mist);
  spec.forEach(([x, y, z, size, baseOpacity], i) => {
    const opacity = baseOpacity * settings.mistOpacity;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size * 0.42),
      new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity, depthWrite: false,
        color: '#8fa3b5', side: THREE.DoubleSide,
      }),
    );
    m.rotation.x = -Math.PI / 2.35;
    m.position.set(x, y, z);
    m.renderOrder = 2;
    scene.add(m);
    banks.push({ mesh: m, baseX: x, drift: 0.12 + i * 0.04, phase: i * 1.7 });
  });
  return banks;
}

function makeMistTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = makeLcg(0x3f0661a);
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 60; i++) {
    const cx = rand() * size;
    const cy = size * (0.3 + rand() * 0.4);
    const r = 20 + rand() * 60;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(255,255,255,${0.05 + rand() * 0.09})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  // Fade the edges so the sheets never show a hard rectangle.
  const edge = ctx.createLinearGradient(0, 0, 0, size);
  edge.addColorStop(0, 'rgba(0,0,0,1)');
  edge.addColorStop(0.5, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// ------------------------------------------------------------ backdrop ---
// Rolling hills and thick pine woods ringing the whole scene, so the church
// sits in Alabama low country rather than on an empty plane. Everything here
// The band is closer than "distant scenery" instinct suggests, and that is
// deliberate: at the approach's fog density (0.03) anything past ~55m is
// extinguished entirely. A first attempt put the treeline at 40-88m and the
// ridge at 105m, and none of it rendered at all -- the horizon was a flat
// grey band. These distances put the woods inside the range fog still
// leaves visible, while the 20m corridor clearance keeps them from looming.
export const PINE_INNER = 26;
export const PINE_OUTER = 54;
export const HILL_RADIUS = 68;

// Deterministic pine placement in a ring around the scene, held clear of the
// road corridor and of the church's own footprint.
export function pineSpots(count) {
  const rand = makeLcg(0x7a1c0de5);
  const samples = [];
  for (let i = 0; i <= 60; i++) samples.push(positionAt(i / 60));
  const spots = [];
  let guard = 0;
  while (spots.length < count && guard < count * 30) {
    guard += 1;
    const a = rand() * Math.PI * 2;
    const r = PINE_INNER + rand() * (PINE_OUTER - PINE_INNER);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    // These are BACKGROUND woods, so the clearance that matters is not
    // "does it touch the road" but "does it loom over the camera". At 7m a
    // 6m pine fills the frame; the first render put one squarely in the
    // corner of the opening shot. 20m keeps them where they read as a
    // treeline instead of as scenery the visitor walks into.
    let near = Infinity;
    for (const p of samples) near = Math.min(near, Math.hypot(p.x - x, p.z - z));
    if (near < 20) continue;
    if (Math.hypot(x, z + 5) < 16) continue;
    spots.push([+x.toFixed(1), +z.toFixed(1), +(0.65 + rand() * 0.8).toFixed(2)]);
  }
  return spots;
}

// A single conifer, as a stack of BRANCH TIERS over a short trunk.
//
// This was two smooth cones. At the distances involved the only thing that
// survives the fog is the SILHOUETTE, and a cone's silhouette is two perfectly
// straight lines meeting at a point — which the eye reads as a geometric
// primitive instantly, no matter how well it is lit or coloured. A real
// conifer's outline is a stack of drooping branch whorls: it steps in and out
// on the way up, and no two steps are the same.
//
// So: several short, wide-based tiers, each one rotated off its neighbour and
// jittered in radius, height and lateral offset. The profile now breaks up
// every few metres and the trees lean slightly off true. Deterministic (fixed
// LCG) so the treeline is identical on every load.
export function pineGeometry(seed = 0xc0ffee) {
  const rand = makeLcg(seed);
  const parts = [];

  const trunk = new THREE.CylinderGeometry(0.14, 0.3, 2.2, 5);
  trunk.translate(0, 1.1, 0);
  parts.push(trunk);

  // Tiers run from a wide skirt at the bottom to a spire at the top.
  const TIERS = 6;
  let y = 1.5;
  for (let i = 0; i < TIERS; i++) {
    const v = i / (TIERS - 1);
    // Radius tapers up the tree, with enough jitter that no two tiers line up
    // into a straight cone edge.
    const radius = (1.95 - v * 1.55) * (0.82 + rand() * 0.36);
    const height = (2.3 - v * 0.9) * (0.85 + rand() * 0.3);
    // 5 radial segments, deliberately low: the faceting IS the branchiness at
    // this distance, and it costs a third of what a smooth cone does.
    const tier = new THREE.ConeGeometry(radius, height, 5);
    // Spin each tier so the facets never stack into a continuous ridge.
    tier.rotateY(rand() * Math.PI * 2);
    // Real whorls are not centred on the trunk.
    tier.translate((rand() - 0.5) * 0.22, y + height * 0.35, (rand() - 0.5) * 0.22);
    parts.push(tier);
    // Tiers overlap rather than stack, so there is no gap to see through.
    y += height * 0.52;
  }

  const geo = mergeGeometries(parts);

  // The wind shader needs to know how far up the tree each vertex sits.
  // Pines share the grass's sway code, so they use the same attribute names
  // — one gust crosses the grass, the reeds and the treeline together.
  // Measured from the geometry that was actually built, not from a constant
  // kept in sync by hand: the tier loop's jitter means the final height moves
  // whenever the tiers are retuned, and a stale constant would silently
  // either clamp the crowns to a rigid cap or stop them reaching full sway.
  geo.computeBoundingBox();
  const top = Math.max(geo.boundingBox.max.y, 1e-4);
  const pos = geo.getAttribute('position');
  const heights = new Float32Array(pos.count);
  const phases = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    heights[i] = Math.min(Math.max(pos.getY(i) / top, 0), 1);
    phases[i] = 0; // variation comes from each instance's position instead
  }
  geo.setAttribute('aHeight', new THREE.BufferAttribute(heights, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  return geo;
}

function buildBackdrop(scene, tier) {
  // The woods.
  const count = tier === 'low' ? 220 : 520;
  const pineMat = new THREE.MeshStandardMaterial({
    // Lighter than the fog it stands in (NIGHT_SKY #141d30), not darker:
    // anything darker than the fog colour converges to it with distance and
    // simply disappears. A treeline in mist reads as a PALE band against the
    // night, which is also how it looks in the reference photography.
    // White here because the per-instance colours below carry the tone.
    color: '#ffffff',
    roughness: 1,
  });
  // Trees sway far less than grass and much more slowly — a conifer moves as
  // one mass, it does not whip. Same uWind clock as the grass, so the gust
  // that crosses the field carries on into the woods.
  applySway(pineMat, { amount: 0.22, speed: 0.16 });

  const pines = new THREE.InstancedMesh(pineGeometry(), pineMat, count);
  pines.name = 'pineWoods';
  const dummy = new THREE.Object3D();
  const spots = pineSpots(count);
  const tint = new THREE.Color();
  const base = new THREE.Color('#2c3d33');
  const tintRand = makeLcg(0x11cede7);
  spots.forEach(([x, z, sc], i) => {
    dummy.position.set(x, 0, z);
    dummy.rotation.set(
      // Woods on uneven ground do not all stand plumb.
      (tintRand() - 0.5) * 0.1,
      (i * 2.399) % (Math.PI * 2),
      (tintRand() - 0.5) * 0.1,
    );
    dummy.scale.set(sc, sc * (0.85 + ((i * 29) % 50) / 100), sc);
    dummy.updateMatrix();
    pines.setMatrixAt(i, dummy.matrix);

    // Every pine was previously the exact same flat colour, which made the
    // whole treeline read as one cut-out band rather than as many trees at
    // many depths. Varying the tone per tree — and lifting the far ones
    // toward the fog colour — restores the depth the fog alone cannot give.
    const depth = Math.min(Math.hypot(x, z) / PINE_OUTER, 1);
    tint.copy(base)
      .multiplyScalar(0.72 + tintRand() * 0.5)
      .lerp(new THREE.Color(NIGHT_SKY), depth * 0.45);
    pines.setColorAt(i, tint);
  });
  pines.count = spots.length;
  pines.instanceMatrix.needsUpdate = true;
  if (pines.instanceColor) pines.instanceColor.needsUpdate = true;
  scene.add(pines);

  // The hills: a ring wall whose top edge undulates, read as a horizon
  // silhouette rather than as modelled terrain. Unlit and fog-affected, so
  // it fades into the mist exactly like the woods in front of it.
  const segments = 96;
  const pos = [];
  const idx = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const x = Math.cos(a) * HILL_RADIUS;
    const z = Math.sin(a) * HILL_RADIUS;
    const h = 9
      + Math.sin(a * 2.0) * 4.5
      + Math.sin(a * 3.7 + 1.1) * 3.0
      + Math.sin(a * 6.3 + 2.4) * 1.6;
    pos.push(x, 0, z, x, h, z);
    if (i > 0) {
      const b = (i - 1) * 2;
      idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }
  const hillGeo = new THREE.BufferGeometry();
  hillGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  hillGeo.setIndex(idx);
  hillGeo.computeVertexNormals();
  const hills = new THREE.Mesh(
    hillGeo,
    // Same reasoning as the pines: pale enough to sit above the fog value
    // so the ridge reads as a silhouette instead of dissolving into it.
    new THREE.MeshBasicMaterial({ color: '#26344a', side: THREE.BackSide }),
  );
  hills.name = 'hills';
  scene.add(hills);
}

// Deterministic, and held clear of the camera corridor — the clearance test
// is only meaningful against fixed positions.
export function swampReedSpots(count) {
  const rand = makeLcg(0x5eed1e55);
  const samples = [];
  for (let i = 0; i <= 120; i++) samples.push(positionAt(i / 120));
  const spots = [];
  let guard = 0;
  while (spots.length < count && guard < count * 40) {
    guard += 1;
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * SWAMP_RADIUS;
    const x = SWAMP_CENTRE[0] + Math.cos(a) * r;
    const z = SWAMP_CENTRE[1] + Math.sin(a) * r;
    let min = Infinity;
    for (const p of samples) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < min) min = d;
    }
    if (min > 1.3) spots.push([+x.toFixed(2), +z.toFixed(2)]);
  }
  return spots;
}


// Cypress-style dead trees standing back from the approach, deterministic
// and clear of the camera corridor.
export function swampTreeSpots() {
  // Measured clearances from the scenic road, in order: 9.2, 10.2, 8.2, 7.3,
  // 5.7, 6.4, 4.6m. Two earlier spots sat on the road's RETURN leg (which
  // runs z 8 -> 4, well south of the row itself) at 2.4m and 1.35m — close
  // enough for the camera to drive through a trunk on the way home.
  return [
    [-9.5, 40.0, 0.4, 1.15],
    [10.5, 36.0, 1.9, 1.0],
    [-11.0, 31.0, 2.6, 1.2],
    [11.5, 27.5, 0.9, 1.05],
    [-10.0, 22.0, 2.2, 1.1],
    [10.0, 17.5, 1.3, 0.95],
    [-9.0, 12.0, 0.2, 1.1],
    [9.5, 8.0, 1.6, 1.05],
  ];
}


let swampWater = [];

function buildSwamp(scene, models, tier) {
  // Standing swamp water. Two things it must NOT be: a black void (the first
  // version, too dark and metallic to reflect anything in this scene) or a
  // mirror (the second, a perfectly flat plane at low roughness, which is why
  // it read as polished glass). Real still water in a marsh is mostly
  // scattered surface detail -- duckweed, silt, broken reflections -- so this
  // reads as water because of its DETAIL and its MOTION, not its shine.
  //
  // And it is now two pools either side of the causeway rather than one disc
  // through the middle of it: see POOLS above.
  const waterTex = makeWaterTexture();
  swampWater = poolShapes().map((pool) => {
    const mat = new THREE.MeshStandardMaterial({
      // Much darker and far more specular than before (was #121b17 at
      // roughness 0.62 / metalness 0.12, which is a MATTE surface -- it
      // scattered the moonlight back evenly in every direction and came out
      // paler than the ground it sat in). Water is not matte: it is dark
      // where you look into it and it reflects where you look across it, so
      // the albedo goes down and the roughness comes right down with it. What
      // brightness there is now comes from the moon's specular and from the
      // Fresnel term above, both of which change with viewing angle.
      color: '#080f0d',
      map: waterTex,
      vertexColors: true,
      roughness: 0.22,
      metalness: 0.4,
    });
    applyWaterMotion(mat);
    const mesh = new THREE.Mesh(buildPool(pool), mat);
    // Down in the basin the ground carves for it (see BASIN_DEPTH), a hand's
    // breadth below the surrounding field. The bed underneath falls away to
    // -0.85m, so the pool holds water to its brim with no basin floor showing
    // through inside the waterline, and the bank is visible all the way
    // round.
    mesh.position.y = WATER_LEVEL;
    mesh.name = 'swampWater';
    scene.add(mesh);
    return mesh;
  });

  // Reeds: the graveyard's tuft, built taller, straighter and colder. Reeds
  // stand up out of water rather than flopping over like dry grass, so they
  // get far less curve and fewer, longer blades per clump.
  const count = tier === 'low' ? 320 : 900;
  const mesh = new THREE.InstancedMesh(
    buildTuftGeometry({
      blades: tier === 'low' ? 3 : 5,
      segments: tier === 'low' ? 3 : 5,
      height: 1.15,
      width: 0.035,
      curve: 0.14,
      spread: 0.04,
      rootColor: '#1c2620',
      tipColor: '#5f6f4d',
      seed: 0x5eedbeef,
    }),
    new THREE.MeshLambertMaterial({
      color: '#ffffff',
      vertexColors: true,
      side: THREE.DoubleSide,
    }),
    count,
  );
  mesh.name = 'swampReeds';
  // Reeds are taller and stand in open water, so they catch more wind — and
  // being slower and heavier, they answer it later.
  applySway(mesh.material, { amount: 0.13, speed: 0.42 });
  const dummy = new THREE.Object3D();
  const spots = swampReedSpots(count);
  spots.forEach(([x, z], i) => {
    // On the terrain, not at a fixed y: the ground now dips into a basin
    // under each pool, so a reed pinned to -0.03 near a pool would stand in
    // mid-air over the hollow. Sunk a little under it so the bases are always
    // buried rather than resting exactly on the surface.
    dummy.position.set(x, groundHeightAt(x, z) - 0.03, z);
    dummy.rotation.set(0, (i * 2.399) % (Math.PI * 2), 0);
    dummy.scale.set(1, 0.85 + ((i * 37) % 70) / 100, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.count = spots.length;
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);

  // Dead cypress standing in the marsh. These used to be eight clones of ONE
  // model — the most repetitive set in the scene. Now each is grown
  // separately, taller and barer than the avenue oaks (less moss, longer
  // strands) because a cypress standing in open water is a spindly thing next
  // to a live oak. Exposed over the water they catch more wind.
  if (models.oak) {
    plantOaks(scene, models.oak.scene, swampTreeSpots(), {
      height: 8.5,
      seed: 0xdead7233,
      // Standing in open water with nothing upwind, so they take more of it.
      sway: { amount: 0.042, speed: 0.24 },
      moss: 26,
      mossLength: 2.4,
      name: 'swampOak',
    });
  }
}

// Wind for a placed GLB prop, as opposed to the instanced grass/pines.
//
// Shares the uWind clock with applySway, so one gust crosses the grass, the
// reeds, the treeline and these trees together — a scene where the ground
// vegetation moves and the trees stand rigid reads as cardboard scenery, and
// that mismatch was the loudest thing about the trees once the grass started
// moving.
//
// Everything that varies per tree (its phase, where it stands, which way the
// wind hits it) is a UNIFORM rather than a baked literal, so all the trees
// share one compiled shader and only the tuning constants split the cache.
export function applyTreeSway(root, {
  amount = 0.028, speed = 0.17, rotY = 0, mirror = false,
  origin = [0, 0], phase = 0, dir = [0.82, 0.57],
} = {}) {
  // The shader works in the mesh's own local space, which sits under this
  // prop's Y rotation — so bending along a fixed local axis would turn the
  // wind with each tree. Rotating the wind into local space on the CPU is
  // free here (unlike the instanced case, which must do it per vertex).
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  let lx = dir[0] * c - dir[1] * s;
  const lz = dir[0] * s + dir[1] * c;
  if (mirror) lx = -lx; // a mirrored prop has a flipped local X axis
  const travel = origin[0] * dir[0] + origin[1] * dir[1];

  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const geo = o.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    const baseY = geo.boundingBox.min.y;
    const spanY = Math.max(geo.boundingBox.max.y - baseY, 1e-4);

    // Per tree, or every tree would share one phase and the wood would sway
    // as a single object. Textures are shared by reference, so this costs
    // nothing in memory.
    const mat = o.material.clone();
    o.material = mat;
    mat.customProgramCacheKey = () => `treesway:${amount}:${speed}`;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uWind = windUniforms.uWind;
      shader.uniforms.uSwayDir = { value: new THREE.Vector2(lx, lz) };
      shader.uniforms.uSwayPhase = { value: phase };
      shader.uniforms.uSwayTravel = { value: travel };
      shader.uniforms.uSwayBase = { value: baseY };
      shader.uniforms.uSwaySpan = { value: spanY };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          uniform float uWind;
          uniform vec2 uSwayDir;
          uniform float uSwayPhase;
          uniform float uSwayTravel;
          uniform float uSwayBase;
          uniform float uSwaySpan;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          {
            // Height up the tree, from its own geometry, so this works for
            // any model at any scale without being told how tall it is.
            // (ASCII only in here: GLSL's source character set does not
            // include punctuation like em-dashes, and strict drivers reject
            // shaders containing them even inside comments.)
            float h = clamp((transformed.y - uSwayBase) / uSwaySpan, 0.0, 1.0);
            float t = uWind * ${speed.toFixed(3)} - uSwayTravel * 0.45 + uSwayPhase;
            float gust = sin(t) + 0.35 * sin(t * 2.3 + 1.1);
            float swell = 0.6 + 0.4 * sin(uWind * 0.11 - uSwayTravel * 0.08);
            // Amount is a FRACTION OF THE TREE'S OWN HEIGHT, so a 6m tree
            // and a 7.5m one move by proportionate amounts rather than by
            // the same absolute distance.
            float bend = h * h * gust * swell * ${amount.toFixed(4)} * uSwaySpan;
            transformed.x += bend * uSwayDir.x;
            transformed.z += bend * uSwayDir.y;
          }`);
    };
    mat.needsUpdate = true;
  });
}

// Mossy boulders scattered through the graveyard field.
//
// Deterministic and held clear of the road corridor and of the hand-placed
// props, so a boulder never lands inside a gravestone or a tree trunk. Same
// rejection-sampling shape as the grass and the reeds.
// Is [px, pz] inside a closed polygon? Standard even-odd ray crossing.
function pointInPolygon(px, pz, poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

export function boulderSpots(count = 11) {
  const rand = makeLcg(0xb01de3);
  const samples = [];
  for (let i = 0; i <= 90; i++) samples.push(positionAt(i / 90));
  // Everything already standing in the field, with the radius each one needs
  // kept clear.
  const taken = [
    ...PROP_SPOTS.graves.map(([x, z]) => [x, z, 2.2]),
    ...PROP_SPOTS.trees.map(([x, z]) => [x, z, 2.2]),
    ...WATCHER_SPOTS.map(([x, z]) => [x, z, 1.8]),
  ];
  // The pools, computed once rather than per candidate.
  const pools = POOLS.map(poolOutline);
  const spots = [];
  let guard = 0;
  while (spots.length < count && guard < count * 60) {
    guard += 1;
    const x = (rand() - 0.5) * 24;
    const z = 4 + rand() * 38;

    let nearPath = Infinity;
    for (const p of samples) nearPath = Math.min(nearPath, Math.hypot(p.x - x, p.z - z));
    // A boulder is up to ~1.4m across, so 2.6m keeps it off the verge.
    if (nearPath < 2.6) continue;
    if (taken.some(([px, pz, r]) => Math.hypot(px - x, pz - z) < r)) continue;
    if (spots.some(([px, pz]) => Math.hypot(px - x, pz - z) < 3)) continue;
    // Keep them out of the water. A boulder is buried into the GROUND, but
    // inside a pool the water surface hides the ground it is buried in, so
    // the rock reads as floating on the pond -- which is exactly how 4 of
    // these 11 looked. 1.6m of bank also stops the ones near an edge from
    // having their waterline cut across them.
    if (pools.some((poly) => pointInPolygon(x, z, poly))) continue;
    if (pools.some((poly) => poly.some(([ex, ez]) => Math.hypot(ex - x, ez - z) < 1.6))) continue;

    spots.push([
      +x.toFixed(2), +z.toFixed(2),
      +(rand() * Math.PI * 2).toFixed(2),
      +(0.55 + rand() * 0.95).toFixed(2),
    ]);
  }
  return spots;
}

// Samples anchor points off a tree's own FOLIAGE geometry, for hanging moss.
//
// Reading the real leaf-card vertices (rather than guessing coordinates from
// the bounding box) means every strand starts on an actual branch, whatever
// model is dropped in and however it is scaled. Only the upper canopy is
// eligible: moss growing off the trunk at head height would read as seaweed.
function foliageAnchors(root, {
  count, rand, minHeightFrac = 0.45, maxRadius = Infinity, match = /branch|leaf|foliage/i,
}) {
  root.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const candidates = [];
  const v = new THREE.Vector3();

  root.traverse((o) => {
    if (!o.isMesh) return;
    const name = `${o.name} ${o.material?.name ?? ''}`;
    if (!match.test(name)) return;
    const pos = o.geometry.getAttribute('position');
    // A leaf atlas can carry thousands of vertices; stepping through it is
    // plenty and keeps this off the critical path at boot.
    const stride = Math.max(1, Math.floor(pos.count / 400));
    for (let i = 0; i < pos.count; i += stride) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(inverse);
      candidates.push([v.x, v.y, v.z]);
    }
  });

  if (!candidates.length) return [];
  const top = Math.max(...candidates.map((c) => c[1]));
  // Only the upper canopy, and only the part of it that is not reaching over
  // the road: moss on a branch directly above the path would hang into the
  // corridor the camera drives down however short the strand is trimmed.
  const high = candidates.filter(
    (c) => c[1] > top * minHeightFrac && Math.hypot(c[0], c[2]) < maxRadius,
  );
  const pool = high.length ? high : candidates.filter((c) => c[1] > top * minHeightFrac);
  if (!pool.length) return [];

  const picked = [];
  for (let i = 0; i < count; i++) picked.push(pool[Math.floor(rand() * pool.length)]);
  return picked;
}

// Plants the live oaks along the approach, and hangs Spanish moss on them.
//
// The oak is a real model (bark mesh + alpha-cut leaf cards, 7,112 triangles)
// rather than the generated tree that used to stand here. Two things it does
// NOT come with, which are added on top:
//   - moss, which no general-purpose oak asset ships and which is the single
//     most identifiable thing about a southern live oak;
//   - wind, applied separately to the trunk and the leaves so the canopy
//     moves against a comparatively stiff trunk instead of the whole tree
//     rocking as one rigid body.
function plantOaks(scene, template, spots, {
  height = 7, seed = 0x7011, sway = { amount: 0.028, speed: 0.19 },
  moss = 30, mossLength = 1.7, name = 'liveOak',
} = {}) {
  const rand = makeLcg(seed);

  spots.forEach(([x, z, rotY, s = 1], i) => {
    const treeHeight = height * s * (0.86 + rand() * 0.3);
    const oak = normalizeProp(template.clone(true), treeHeight);
    oak.position.set(x, groundHeightAt(x, z), z);
    oak.rotation.y = rotY;
    // A little lean, and a mirror on half of them: ten spots dressed from one
    // model is otherwise ten identical trees in a row.
    const mirror = rand() < 0.5;
    if (mirror) oak.scale.x *= -1;
    oak.rotation.x += (rand() - 0.5) * 0.07;
    oak.rotation.z += (rand() - 0.5) * 0.07;
    oak.name = name;

    oak.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const mat = o.material.clone();
      o.material = mat;
      const isLeaf = /branch|leaf|foliage/i.test(`${o.name} ${mat.name ?? ''}`);

      if (isLeaf) {
        // The asset ships its foliage as alphaMode BLEND. Blended geometry
        // has to be drawn back-to-front to composite correctly, and a canopy
        // is thousands of mutually-intersecting cards that cannot be sorted
        // into any correct order -- leaves flicker and vanish behind each
        // other as the camera moves. MASK/alphaTest is order-independent,
        // which is why it is what foliage is supposed to use.
        mat.transparent = false;
        mat.alphaTest = 0.5;
        mat.depthWrite = true;
        mat.side = THREE.DoubleSide;
      }

      // Leaves are lighter and catch far more wind than the trunk does.
      applyTreeSway(o, {
        amount: isLeaf ? sway.amount * 2.6 : sway.amount,
        speed: sway.speed,
        rotY,
        mirror,
        origin: [x, z],
        phase: rand() * Math.PI * 2,
      });
    });

    // Moss, hung off the oak's own leaf cards. How far out it may hang is
    // derived from THIS tree's measured distance to the camera corridor, so
    // a tree standing further back gets a fuller drape than one crowding the
    // road, rather than every tree being trimmed to suit the closest one.
    const clearance = minPathClearance([[x, z]]);
    const anchors = foliageAnchors(oak, {
      count: Math.round(moss * (0.7 + rand() * 0.6)),
      rand,
      minHeightFrac: 0.5,
      maxRadius: Math.max(clearance - 1.5, 1),
    });
    if (anchors.length) {
      const mossGeo = buildMossCurtains(anchors, {
        seed: seed + i * 7919,
        length: mossLength * (0.75 + rand() * 0.5),
        totalHeight: treeHeight,
      });
      const mossMat = new THREE.MeshLambertMaterial({
        color: '#ffffff', vertexColors: true, side: THREE.DoubleSide,
      });
      // Moss swings much further than either the leaves or the trunk.
      applyBranchSway(mossMat, {
        amount: sway.amount * 2.2, speed: sway.speed * 0.8, rotY, mirror, origin: [x, z],
      });
      const mossMesh = new THREE.Mesh(mossGeo, mossMat);
      mossMesh.name = `${name}Moss`;
      oak.add(mossMesh);
    }

    scene.add(oak);
  });
}

// Places clones of a template at fixed spots.
//
// `vary` breaks up the repetition that comes of dressing ten spots from two
// models: without it the approach is five identical trees down one side and
// five identical trees down the other, distinguishable only by yaw, and the
// eye picks that out immediately however good the model is.
//   - mirroring flips the silhouette outright, which is the cheapest way to
//     double the apparent number of distinct models (safe here: both tree
//     GLBs are authored doubleSided).
//   - independent height/width scaling turns one tree into a squat one and a
//     lanky one.
//   - a slight lean off plumb, which for the gravestones is not variation for
//     its own sake but the Ghost-Rider reference itself.
// `sink` buries the prop by a fraction of its own height.
//
// Needed for raw photogrammetry scans, which are OPEN SHELLS: a scanner never
// sees an object's underside, so there is no bottom face at all. The mossy
// stone has 1,939 boundary edges out of 6,650 and no base whatsoever, so
// resting it on y=0 shows straight into the hollow, and the `vary` tilt lifts
// one edge and exposes more of it. Burying the ragged part is also simply
// what a rock in a field looks like — half in the ground, not set on top of
// it. Measured from the object's real transformed bounding box rather than
// its nominal height, so per-spot and `vary` scaling are already accounted
// for.
function place(scene, template, spots, {
  vary = false, sway = null, seed = 0x5ca1ab1e, sink = 0,
} = {}) {
  const rand = makeLcg(seed);
  for (const [x, z, rotY, s] of spots) {
    const obj = template.clone(true);
    // On the terrain, not at y=0. The ground dips into a basin under each
    // pond, and a prop pinned to zero hovers over the hollow -- which is
    // exactly how the gravestones and rocks near the water ended up floating.
    obj.position.set(x, groundHeightAt(x, z), z);
    obj.rotation.y = rotY;
    obj.scale.multiplyScalar(s);

    let mirror = false;
    if (vary) {
      mirror = rand() < 0.5;
      const tall = 0.86 + rand() * 0.34;
      const wide = 0.86 + rand() * 0.3;
      obj.scale.x *= wide * (mirror ? -1 : 1);
      obj.scale.y *= tall;
      obj.scale.z *= wide;
      obj.rotation.x += (rand() - 0.5) * 0.1;
      obj.rotation.z += (rand() - 0.5) * 0.1;

      // A negative scale flips triangle winding, so every front face becomes
      // a back face. The tree GLBs are authored doubleSided and survive that,
      // but the gravestones are not — mirrored, they would render inside-out
      // (front faces culled, lit by inverted normals). DoubleSide costs one
      // material clone on a handful of props and makes mirroring safe for
      // whatever model is dropped in here later.
      if (mirror) {
        obj.traverse((o) => {
          if (!o.isMesh || !o.material) return;
          o.material = o.material.clone();
          o.material.side = THREE.DoubleSide;
        });
      }
    }

    if (sway) {
      applyTreeSway(obj, {
        ...sway,
        rotY,
        mirror,
        origin: [x, z],
        phase: rand() * Math.PI * 2,
      });
    }

    if (sink > 0) {
      obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj);
      const height = box.max.y - box.min.y;
      // Vary how deep each one sits: a row of rocks all buried to exactly the
      // same fraction reads as a repeated object, which is the same tell the
      // trees had. Measured down from the TERRAIN rather than from y=0, so a
      // rock on a pool's bank is buried into the slope instead of hanging
      // above it.
      obj.position.y -= height * sink * (0.75 + rand() * 0.5);
    }

    scene.add(obj);
  }
}

// Normalize a GLTF scene: uniform scale to targetHeight, feet on y=0,
// centered on x/z origin. Returns the wrapped group.
//
// `centerMatch` (optional regex on mesh name) narrows which meshes decide
// the x/z centering — needed for the church, whose bell tower sits well off
// to one side and would otherwise drag the whole building's centerline off
// the aisle. Height scale and the final push-to-floor still use the full
// model so the tower keeps its true silhouette height.
function normalize(gltfScene, targetHeight, centerMatch) {
  const root = new THREE.Group();
  root.add(gltfScene);
  const box = new THREE.Box3().setFromObject(gltfScene);
  const size = box.getSize(new THREE.Vector3());
  const scale = targetHeight / size.y;
  gltfScene.scale.setScalar(scale);

  let centerBox = new THREE.Box3().setFromObject(gltfScene);
  if (centerMatch) {
    const narrowed = new THREE.Box3();
    let found = false;
    gltfScene.traverse((o) => {
      if (o.isMesh && centerMatch.test(o.name)) {
        narrowed.expandByObject(o);
        found = true;
      }
    });
    if (found) centerBox = narrowed;
  }
  const center = centerBox.getCenter(new THREE.Vector3());
  gltfScene.position.x -= center.x;
  gltfScene.position.z -= center.z;

  const floorBox = new THREE.Box3().setFromObject(gltfScene);
  gltfScene.position.y -= floorBox.min.y;
  return root;
}

export function buildWorld({ scene, models, grassCount = 0, tier = 'high', settings = TIERS[tier] }) {
  // Sky dome: un-tonemapped so it stays a legible hazy navy instead of
  // crushing to black (see NIGHT_SKY comment above). Radius sits inside the
  // camera's far plane (130) and fog:false keeps it a flat, un-hazed backdrop
  // — real ground fog thickens near the horizon, not the open sky above it.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(115, 16, 12),
    new THREE.MeshBasicMaterial({ color: NIGHT_SKY, side: THREE.BackSide, fog: false, toneMapped: false }),
  );
  sky.name = 'skyDome';
  scene.add(sky);

  // Ground: a big dark disc; fog swallows the edge.
  //
  // Tessellated as a radial grid rather than a bare CircleGeometry, because
  // it now has to CARRY the pool basins. A flat plane with a water quad on
  // top gives a shoreline with nothing behind it; dishing the terrain under
  // each pool is what puts a visible bank between the field and the water,
  // which is the cue that was missing. Rings are packed tightly out to ~50m
  // (where everything the camera passes actually is) and coarsely beyond.
  const ground = new THREE.Mesh(
    buildGroundGeometry(settings),
    // ACES Filmic tone mapping crushes low-albedo colors hard toward black
    // (its shadow "toe"), so a ground plane dark enough to look right on
    // paper renders as near-invisible once lit and tone-mapped — bumped
    // notably lighter than a literal dead-grass color would suggest so it
    // actually reads under the moon/hemisphere lighting. DoubleSide is kept
    // as a safety net: an earlier version built this from a CircleGeometry
    // rotated into place and had the sign of that rotation wrong, leaving the
    // disc's normal facing down and the ground invisible to every camera in
    // the scene. It is now built directly in the XZ plane with real computed
    // normals, so there is no rotation left to get wrong.
    new THREE.MeshStandardMaterial({ color: '#3a4132', roughness: 1, side: THREE.DoubleSide }),
  );
  ground.name = 'ground';
  scene.add(ground);

  buildRoad(scene);
  buildGrass(scene, grassCount, tier);
  buildSwamp(scene, models, tier);
  buildBackdrop(scene, tier);
  const rose = buildWindowGlow(scene);
  const mist = buildMist(scene, settings);

  // Moonlight from behind the chapel + a hemisphere fill so silhouettes read
  // in the fog without flattening the southern-gothic near-dark mood.
  //
  // task-12: earlier rounds pushed these to extreme values (moon 9,
  // hemisphere 4, exposure 2.3) chasing "still too dark" feedback that
  // turned out to be a missing sRGB-encode step in the post-processing
  // final pass (see the fix + explanation in scenes/post.js) — every light
  // bump was fighting a bug that gamma-crushed the final framebuffer, not
  // actual insufficient light. With that fixed, values close to the
  // original brief's targets read correctly again.
  const MOON_LIGHT_POS = new THREE.Vector3(-6, 18, -30);
  const moon = new THREE.DirectionalLight('#b9c4d6', 3.5);
  moon.position.copy(MOON_LIGHT_POS);
  scene.add(moon, new THREE.HemisphereLight('#4a5c78', '#241c14', 1.6));

  // Visible moon disc: a pale, un-tonemapped sphere placed along the SAME
  // direction the moon DirectionalLight shines from (so the glow the church
  // catches actually has a legible source overhead), plus a larger, fainter
  // additive halo sprite behind it for a soft glow. Distance 70 keeps it
  // comfortably inside the sky dome (radius 115) and camera far plane (130),
  // high enough in the frame to sit above/behind the church silhouette
  // during the approach without drifting off the top edge. Un-tonemapped for
  // the same reason as the sky dome/road/ground comments above: ACES's
  // shadow toe crushes near-white/near-black values unpredictably depending
  // on exposure, and a moon that dims when exposure is tuned down reads as
  // a bug, not mood.
  const moonPos = MOON_LIGHT_POS.clone().normalize().multiplyScalar(70);
  const moonDisc = new THREE.Mesh(
    new THREE.SphereGeometry(3.5, 20, 16),
    new THREE.MeshBasicMaterial({ color: '#cfd8e8', fog: false, toneMapped: false }),
  );
  moonDisc.position.copy(moonPos);
  moonDisc.name = 'moonDisc';
  scene.add(moonDisc);

  const moonHaloTex = (() => {
    const size = 128;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(207,216,232,0.85)');
    g.addColorStop(0.35, 'rgba(207,216,232,0.32)');
    g.addColorStop(1, 'rgba(207,216,232,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
  })();
  const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: moonHaloTex,
    color: '#cfd8e8',
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  }));
  moonHalo.scale.set(22, 22, 1);
  moonHalo.position.copy(moonPos);
  moonHalo.name = 'moonHalo';
  scene.add(moonHalo);

  // A second moon-toned fill from behind the camera's approach, so the
  // graveyard/tree silhouettes catch light from the front too, not just a
  // single backlit rim — without this the near-black stone/bark GLB
  // materials read as flat cutouts against the fog.
  const approachFill = new THREE.DirectionalLight('#c7d2e6', 1.4);
  approachFill.position.set(4, 12, 40);
  scene.add(approachFill);

  // Chapel: scaled to CHAPEL_TARGET_HEIGHT, doorway on the z=0 plane facing +z.
  // If the model is somehow null (dev only), a box shell keeps the world testable.
  // The source model bakes in its own ground plane (a big flat disc far wider
  // than the building itself); it must be stripped out *before* any bounding
  // box math or it throws off both the facade push-back and the normalize
  // center, and it double-renders/z-fights against our own ground disc above.
  let chapelRoot;
  if (models.church) {
    models.church.scene.traverse((o) => {
      if (o.isMesh && /ground/i.test(o.name) && o.parent) o.parent.remove(o);
    });
    // Center on the nave body only (not the off-axis bell tower) so the
    // aisle lines up with the path's x=0 centerline.
    chapelRoot = normalize(models.church.scene, CHAPEL_TARGET_HEIGHT, /estrutura/i);
    models.church.scene.scale.z *= CHAPEL_Z_STRETCH;
    // Push back so the front facade sits just behind the doorway plane.
    const box = new THREE.Box3().setFromObject(chapelRoot);
    chapelRoot.position.z = -(box.max.z + 0.4);
    // Hide any authored door mesh — we hinge our own for scroll control.
    // Also hide the model's own baked-in altar cross ("cruz_lambert1_0",
    // separate from the tower's "Cruz_torre" ornament which stays): it sits
    // right where our animated neon cross mounts and, being an opaque
    // MeshStandardMaterial nearer the camera, fully occludes it.
    chapelRoot.traverse((o) => {
      if (o.isMesh && /door/i.test(o.name)) o.visible = false;
      if (o.isMesh && /^cruz/i.test(o.name)) o.visible = false;
    });
    if (window.__DEBUG_CHAPEL__) {
      const worldBox = new THREE.Box3().setFromObject(chapelRoot);
      console.log('DEBUG_CHAPEL', JSON.stringify({
        chapelRootPositionZ: chapelRoot.position.z,
        preTranslateBoxMax: { x: box.max.x, y: box.max.y, z: box.max.z },
        preTranslateBoxMin: { x: box.min.x, y: box.min.y, z: box.min.z },
        worldBoxMin: { x: worldBox.min.x, y: worldBox.min.y, z: worldBox.min.z },
        worldBoxMax: { x: worldBox.max.x, y: worldBox.max.y, z: worldBox.max.z },
      }));
      const names = ['arco', 'altar', 'degrau', 'vela', 'calice', 'estrutura', 'torre', 'ground', 'porta', 'door'];
      chapelRoot.traverse((o) => {
        if (!o.isMesh) return;
        const lname = (o.name || '').toLowerCase();
        if (names.some((n) => lname.includes(n))) {
          const b = new THREE.Box3().setFromObject(o);
          console.log('DEBUG_MESH', o.name, JSON.stringify({
            min: { x: b.min.x, y: b.min.y, z: b.min.z },
            max: { x: b.max.x, y: b.max.y, z: b.max.z },
          }));
        }
      });
    }
  } else {
    chapelRoot = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(10, 18, 16),
      new THREE.MeshStandardMaterial({ color: '#0d0f11', roughness: 1, side: THREE.BackSide }),
    );
    shell.position.set(0, 9, -8);
    chapelRoot.add(shell);
  }
  scene.add(chapelRoot);

  // Our own hinged door in the doorway plane, hinge on the left jamb. Sized
  // and positioned to the ACTUAL modeled opening.
  //
  // fix-round: the previous alignment pass (task-12) measured the opening's
  // width/height correctly but got the DEPTH wrong. It found x=[-0.84,1.05],
  // y=[0,2.49] via a raycast sweep at eye height and assumed the facade's
  // flat outer face (z=-0.4, exactly `box.max.z` after chapelRoot's
  // push-back — see above) was also where the door hole sits. It isn't: this
  // portal is a stepped/splayed Gothic reveal, not a flat cut. A full vertex
  // scan of the facade mesh (igreja_partespCube12_igreja_estrutura_0) in the
  // door region found the jamb steps inward through two intermediate planes
  // (z=-0.78, z=-1.14, z=-1.82) before reaching the actual rectangular
  // door-shaped hole — whose jamb AND lintel vertices cluster tightly at
  // x=[-0.837,1.046], y=[0,2.49], z=-2.01. That z is the real door plane:
  // the leaf was floating 1.6m in front of it, flush with the outer
  // pilasters instead of recessed under the portal canopy where a door
  // actually belongs — which is exactly what still read as "misaligned"
  // from the real scroll/camera-sway viewpoint even though the width/height
  // numbers were already correct.
  const DOOR_LEFT_X = -0.84;
  const DOOR_WIDTH = 1.89;
  const DOOR_HEIGHT = 2.49;
  const DOOR_Z = -2.01;
  // Hinged on the LEFT jamb, opening OUTWARD (toward the camera/exterior).
  // The leaf sits 1.6m back inside a stepped Gothic reveal, with a flanking
  // pilaster right at the jamb line — swing the leaf past ~90 degrees (flush
  // against the reveal wall, see doorAngle()'s MAX_ANGLE) and its outer edge
  // digs into that stonework, so the open angle is capped well short of a
  // full swing rather than left free to clip through it.
  const door = new THREE.Group();
  door.position.set(DOOR_LEFT_X, 0, DOOR_Z);
  const leaf = new THREE.Mesh(
    new THREE.BoxGeometry(DOOR_WIDTH, DOOR_HEIGHT, 0.09),
    new THREE.MeshStandardMaterial({ color: '#171310', roughness: 0.9 }),
  );
  leaf.position.set(DOOR_WIDTH / 2, DOOR_HEIGHT / 2, 0);
  door.add(leaf);
  scene.add(door);

  // Red light bleeding through the doorway from inside. Was placed between
  // the old (wrong) door plane and the wall's outer face; now that the door
  // sits at the true recessed plane (z=-2.01), the glow needs to sit further
  // inside it (more negative z) so it still reads as spilling out from the
  // nave through the gap as the door swings, not from in front of the door.
  const doorGlow = new THREE.PointLight('#c1170f', 5, 11, 2);
  doorGlow.position.set(0, 1.8, -2.9);
  scene.add(doorGlow);

  // Set dressing, real GLB or silhouette. Trees are no longer among them —
  // they come from oak.glb now, so tree-a.glb and tree-b.glb are not fetched
  // at all any more.
  const grave = models.gravestoneA?.scene ?? silhouette('grave');
  const graveB = models.gravestoneB?.scene ?? silhouette('graveb');
  // Low tier (likely mobile): thin the heaviest set dressing to ~60% of
  // spots, keeping the ones nearest the path so the visible corridor still
  // reads as dressed. High tier keeps every PROP_SPOTS entry unchanged.
  // Thinned harder than before on low: the oak is 7,112 triangles a copy, so
  // six of them cost more than the church, the truck and every gravestone put
  // together. Keeping the ones nearest the path means the corridor the camera
  // actually travels still reads as fully dressed.
  const keep = settings.propFraction;
  const graveSpots = keep < 1 ? nearestToPath(PROP_SPOTS.graves, keep) : PROP_SPOTS.graves;
  const treeSpots = keep < 1 ? nearestToPath(PROP_SPOTS.trees, keep) : PROP_SPOTS.trees;
  const half = Math.ceil(graveSpots.length / 2);
  // Stones lean, but they do not sway — they are stone.
  place(scene, normalizeProp(grave, 1.1), graveSpots.slice(0, half), { vary: true, seed: 0x51a1 });
  place(scene, normalizeProp(graveB, 1.3), graveSpots.slice(half), { vary: true, seed: 0x51a2 });
  // Mossy boulders through the field, breaking up ground that is otherwise
  // flat between the markers.
  if (models.boulder) {
    place(scene, normalizeProp(models.boulder.scene, 1.05), boulderSpots(settings.boulders), {
      vary: true,
      seed: 0xb01de3,
      // The scan has no underside at all, so a third of it goes under.
      sink: 0.34,
    });
  }

  // The watchers: figures standing motionless back among the trees. Placed
  // last among the set dressing so nothing else can be positioned relative to
  // them by accident. They carry no animation and no update loop — the
  // lightning does all the work (see WATCHER_SPOTS).
  if (models.watcher) {
    for (const [wx, wz, wrot] of WATCHER_SPOTS) {
      const watcher = normalizeProp(models.watcher.scene.clone(true), 1.78);
      watcher.position.set(wx, groundHeightAt(wx, wz), wz);
      watcher.rotation.y = wrot;
      watcher.name = 'watcher';
      watcher.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        const mat = o.material.clone();
        o.material = mat;
        // Sunk toward the dark so they are barely there under moonlight and
        // it is the strike that picks them out. Left brighter, the figures
        // would simply be three people standing in a field.
        mat.color?.multiplyScalar(0.4);
        o.material = mat;
      });
      scene.add(watcher);
    }
  }

  // The avenue: moss-draped live oaks. If oak.glb is missing the approach
  // simply has no trees rather than falling back to a shape that reads worse
  // than nothing — every other prop here degrades the same way.
  if (models.oak) {
    plantOaks(scene, models.oak.scene, treeSpots, {
      height: 7,
      seed: 0x77ee01,
      sway: { amount: 0.028, speed: 0.19 },
      moss: 34,
      mossLength: 1.7,
    });
  }

  // Altar anchor: where the cross + altar light mount, on the chapel's own
  // interior back wall (just in front of it, facing the aisle) rather than a
  // hardcoded guess — derived from the actual (post-alignment) chapel bbox
  // so it tracks CHAPEL_Z_STRETCH and any future model swap.
  // chapelBox.min.z is the deepest point of the WHOLE bbox (a buttress or
  // uneven apse detail off the aisle centerline can drag this well behind
  // the actual flat wall surface the camera faces) — task-12 raycast probes
  // straight down the aisle found the real wall surface at the altar's x/y
  // sitting ~0.9m in front of that overall min, so 0.35m of margin left the
  // cross embedded inside solid wall geometry (invisible, z-fighting).
  // 1.3m clears it with room to spare.
  const interiorBack = new THREE.Box3().setFromObject(chapelRoot).min.z;
  const altarAnchor = new THREE.Object3D();
  altarAnchor.position.set(0, 2.6, interiorBack + 1.3);
  scene.add(altarAnchor);

  // Always-on, dim interior fill: the moon/hemisphere read the exterior and
  // reach a little way through the open door, but the nave depths (before
  // any candles are lit) would otherwise sit fully black — a windowless box
  // as far as scene lighting is concerned, since the walls block the
  // exterior lights' contribution once inside. Two soft warm pools, roughly
  // mid-aisle and at the altar, keep pews and the far wall just legible.
  const interiorFillA = new THREE.PointLight('#5a4636', 1.6, 9, 2);
  interiorFillA.position.set(0, 3.2, interiorBack * 0.4);
  scene.add(interiorFillA);
  const interiorFillB = new THREE.PointLight('#5a4636', 1.3, 8, 2);
  interiorFillB.position.set(0, 3, interiorBack + 2.5);
  scene.add(interiorFillB);

  const chapelBox = new THREE.Box3().setFromObject(chapelRoot);
  // Roofline for the crows to perch on. task-12 tried lowering this onto the
  // roof and reverted after it appeared to get occluded — but that was a
  // guessed y (chapelBox.max.y - 0.2 ≈ 17.8, near the TOWER's full height)
  // that never actually reached the roof surface at all; it just floated in
  // clear air well above the real ridge, which is why crows read as "too
  // high and static" in review. A raycast probe against the live geometry
  // found the actual pitched roof plane sits around y≈7–9.4 (sloping from
  // ridge to eave) starting a bit past the entrance canopy — this raycasts
  // straight down at each crow's real perch x (see crows.js) so every bird
  // sits ON the roof surface, never inside or floating above it, however the
  // model's roof pitch happens to run.
  chapelRoot.updateMatrixWorld(true);
  const roofFallbackY = chapelBox.max.y - 0.2;
  const roofZ = chapelBox.min.z * 0.18; // past the porch overhang, onto the main roof pitch
  function roofHeightAt(x) {
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(x, chapelBox.max.y + 10, roofZ),
      new THREE.Vector3(0, -1, 0),
      0,
      40,
    );
    const hits = raycaster.intersectObject(chapelRoot, true);
    return hits.length ? hits[0].point.y : roofFallbackY;
  }
  return {
    chapelRoot,
    door,
    altarAnchor,
    rose,
    mist,
    water: swampWater,
    roofline: { y: roofHeightAt(0), z: roofZ, heightAt: roofHeightAt },
  };
}

function normalizeProp(objScene, targetHeight) {
  return normalize(objScene, targetHeight);
}
