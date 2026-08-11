import * as THREE from 'three';
import { positionAt, T_DOOR, tNearest, LANDMARKS } from './path.js';

// Night sky/fog tone, shared with sceneManager.js. Deliberately NOT applied
// through ACES Filmic tone mapping for the sky dome below: at the exposure
// needed to make the graveyard/church legible (2.3), tone mapping's shadow
// "toe" crushes any near-black background color to true (0,0,0) — the void
// read as pitch-black in every approach screenshot regardless of how bright
// this constant was set. The dome sidesteps that by disabling toneMapped on
// its material, so the sky reads as a lit, hazy navy night rather than an
// empty black hole above the lit ground.
export const NIGHT_SKY = '#141d30';

// Hand-placed prop spots [x, z, rotY, scale] flanking the path's S-curve.
// Deterministic (no Math.random) so the corridor-clearance test is real.
export const PROP_SPOTS = {
  // Ghost-Rider-graveyard density: a near flanking row hugging the road plus
  // a second row set further back, so the approach reads as a dense field of
  // leaning stones receding into the fog rather than scattered set dressing.
  graves: [
    // near row (original 10)
    [-3.2, 34, 0.3, 1], [3.6, 31, -0.2, 0.9], [-2.8, 27, 0.8, 1.1],
    [4.2, 24, -0.5, 1], [-4.5, 21, 0.1, 0.85], [3.4, 17, 0.6, 1],
    [-3.0, 14, -0.4, 0.95], [3.8, 12, 0.2, 1.05], [-3.6, 8.5, -0.7, 1],
    [3.1, 6.5, 0.4, 0.9],
    // near row, extended further out toward the misty horizon
    [-3.4, 41, 0.5, 1], [3.9, 38, -0.3, 0.95],
    // far row, set back beyond the trees for depth
    [-6.0, 33, 0.2, 1], [6.4, 29.5, -0.6, 0.9], [-5.8, 25.5, 0.9, 1.05],
    [6.6, 22.5, -0.1, 0.85], [-6.2, 19, 0.4, 1], [6.0, 15.5, -0.5, 0.95],
    [-5.6, 10.5, 0.3, 1], [5.9, 7.5, -0.4, 0.9],
  ],
  trees: [
    [-6.5, 38, 0, 1.1], [7, 33, 1.2, 1], [-7.5, 26, 2.1, 0.9],
    [6.8, 20, 0.4, 1.2], [-6.2, 13, 2.8, 1], [7.2, 8, 1.7, 0.95],
    [7.8, 43, 0.9, 1], [-8.0, 30, 1.5, 0.95], [7.5, 16, 2.3, 1.05], [-6.8, 5.5, 0.6, 0.9],
  ],
};

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
export function roadEndT(route = 'direct') {
  const doorT = route === 'direct' ? T_DOOR : tNearest(LANDMARKS.DOOR, route);
  return Math.min(doorT - 0.015, 0.98);
}

// A road nearly three times longer needs proportionally more segments, or
// its curves visibly facet into straight lines.
export function roadSampleCount(route = 'direct') {
  return route === 'work' ? 260 : 90;
}

function buildRoad(scene, route = 'direct') {
  const steps = roadSampleCount(route);
  const endT = roadEndT(route);
  const baseWidth = 2.2;
  const up = new THREE.Vector3(0, 1, 0);
  const positions = [];
  const indices = [];
  let vi = 0;
  for (let i = 0; i <= steps; i++) {
    const t = (endT * i) / steps;
    const p = positionAt(t, route);
    const ahead = positionAt(Math.min(t + 0.004, 1), route);
    const tangent = new THREE.Vector3().subVectors(ahead, p).normalize();
    const perp = new THREE.Vector3().crossVectors(up, tangent).normalize();
    const wobble = Math.sin(i * 0.7) * 0.35 + Math.sin(i * 0.23 + 1.3) * 0.2;
    const wornPatch = Math.sin(i * 0.31) > 0.85 ? 0.4 : 1; // rare thin/broken stretch
    const halfW = Math.max(0.22, (baseWidth + wobble) * wornPatch) / 2;
    const left = p.clone().addScaledVector(perp, -halfW);
    const right = p.clone().addScaledVector(perp, halfW);
    left.y = 0.012;
    right.y = 0.012;
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
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
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: '#5a4530', roughness: 1, side: THREE.DoubleSide });
  const road = new THREE.Mesh(geo, mat);
  road.name = `roadRibbon-${route}`;
  scene.add(road);
}

// Small deterministic PRNG (LCG) so grass placement is stable frame-to-frame
// and across reloads — Math.random() would reshuffle every build, making the
// "avoid the path corridor" clearance impossible to reason about or test.
function makeLcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// One instanced "cross quad" tuft geometry: two vertical planes intersecting
// at right angles through the Y axis, base pinned at y=0. Cheaper than a
// billboard sprite per tuft (no per-frame camera-facing math) while still
// reading as volumetric grass from most viewing angles.
function buildGrassBladeGeometry() {
  const w = 0.5;
  const h = 0.7;
  const positions = new Float32Array([
    -w / 2, 0, 0, w / 2, 0, 0, w / 2, h, 0, -w / 2, h, 0,
    0, 0, -w / 2, 0, 0, w / 2, 0, h, w / 2, 0, h, -w / 2,
  ]);
  const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1]);
  const index = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

// Procedural canvas texture of a few grass blades, desaturated gray-green to
// match the near-dead Ghost-Rider-graveyard field rather than healthy lawn.
function makeGrassTexture() {
  const size = 32;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const shades = ['#2a2f22', '#333a28', '#242a1c', '#3a4130'];
  for (let i = 0; i < 7; i++) {
    const bx = ((i + 0.5) / 7) * size + Math.sin(i * 3.1) * 2.5;
    ctx.strokeStyle = shades[i % shades.length];
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(bx, size);
    ctx.quadraticCurveTo(bx + Math.sin(i) * 3, size * 0.5, bx + Math.sin(i * 1.7) * 4, 1);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// Tall unkempt grass tufts scattered across the field/graveyard, avoiding
// the dirt road corridor (>=1.2m clearance) so the path stays legible, and
// weighted denser around the grave spots per the Ghost-Rider reference.
function buildGrass(scene, count) {
  if (!count) return;
  const rand = makeLcg(0x9e3779b1);
  const pathSamples = [];
  for (let i = 0; i <= 80; i++) pathSamples.push(positionAt(i / 80));
  const graveXZ = PROP_SPOTS.graves.map(([x, z]) => [x, z]);

  const geo = buildGrassBladeGeometry();
  const mat = new THREE.MeshBasicMaterial({
    map: makeGrassTexture(),
    color: '#8a9070',
    transparent: true,
    alphaTest: 0.35,
    side: THREE.DoubleSide,
  });
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
    let minD = Infinity;
    for (const p of pathSamples) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < minD) minD = d;
      if (minD < 1.2) break;
    }
    if (minD < 1.2) continue;
    const bladeH = 0.4 + rand() * 0.5;
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.set(0.85 + rand() * 0.3, bladeH / 0.7, 0.85 + rand() * 0.3);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
}


// ---------------------------------------------------------------- swamp ---
// Low wet country around the monument row on the scenic road. Deliberately
// far from the church so the two places read as different countries. This
// reuses the graveyard's own grass geometry and placement helpers with
// swampier parameters rather than introducing a second vegetation system.
export const SWAMP_CENTRE = [42, 18];
export const SWAMP_RADIUS = 24;

// Deterministic, and held clear of the camera corridor — the clearance test
// is only meaningful against fixed positions.
export function swampReedSpots(count) {
  const rand = makeLcg(0x5eed1e55);
  const samples = [];
  for (let i = 0; i <= 120; i++) samples.push(positionAt(i / 120, 'work'));
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

// Dead trees standing back from the row, deterministic and clear of the road.
export function swampTreeSpots() {
  // Measured clearances from the scenic road, in order: 9.2, 10.2, 8.2, 7.3,
  // 5.7, 6.4, 4.6m. Two earlier spots sat on the road's RETURN leg (which
  // runs z 8 -> 4, well south of the row itself) at 2.4m and 1.35m — close
  // enough for the camera to drive through a trunk on the way home.
  return [
    [30.5, 29.0, 0.4, 1.15],
    [46.0, 28.2, 1.9, 1.0],
    [61.5, 25.0, 2.6, 1.2],
    [24.0, 12.0, 0.9, 1.05],
    [39.0, 11.5, 2.2, 1.1],
    [68.0, 18.0, 1.3, 0.95],
    [20.0, 26.0, 0.2, 1.1],
  ];
}

function buildSwamp(scene, models, tier) {
  // Still black water just below the ground plane, so the shoreline is the
  // ground's own edge rather than a modelled bank.
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(SWAMP_RADIUS, 56),
    // Reads as still water catching the night sky, not a hole in the world.
    // At #0a1110 with metalness 0.55 there was nothing in this scene for it
    // to reflect, so it rendered as a black void the trail appeared to
    // float over.
    new THREE.MeshStandardMaterial({
      color: '#26332f', roughness: 0.3, metalness: 0.25,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  // Just ABOVE the ground plane, but just BELOW the dirt trail (y=0.012):
  // at -0.05 the opaque ground hid it completely, and anything above the
  // trail would flood the road the camera drives along.
  water.position.set(SWAMP_CENTRE[0], 0.006, SWAMP_CENTRE[1]);
  water.name = 'swampWater';
  scene.add(water);

  // Reeds: the graveyard's grass blade, taller and colder, standing in and
  // around the water.
  const count = tier === 'low' ? 260 : 700;
  const mesh = new THREE.InstancedMesh(
    buildGrassBladeGeometry(),
    new THREE.MeshBasicMaterial({
      map: makeGrassTexture(),
      color: '#5d6a4a',
      transparent: true,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
    }),
    count,
  );
  mesh.name = 'swampReeds';
  const dummy = new THREE.Object3D();
  const spots = swampReedSpots(count);
  spots.forEach(([x, z], i) => {
    dummy.position.set(x, -0.03, z);
    dummy.rotation.set(0, (i * 2.399) % (Math.PI * 2), 0);
    dummy.scale.set(1, 1.5 + ((i * 37) % 70) / 100, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.count = spots.length;
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);

  // Dead trees, reusing whichever tree model loaded.
  const treeSrc = models.treeA?.scene ?? models.treeB?.scene ?? silhouette('tree');
  place(scene, normalizeProp(treeSrc.clone(true), 7.5), swampTreeSpots());
}

function place(scene, template, spots) {
  for (const [x, z, rotY, s] of spots) {
    const obj = template.clone(true);
    obj.position.set(x, 0, z);
    obj.rotation.y = rotY;
    obj.scale.multiplyScalar(s);
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

export function buildWorld({ scene, models, grassCount = 0, tier = 'high' }) {
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
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(90, 48),
    // ACES Filmic tone mapping crushes low-albedo colors hard toward black
    // (its shadow "toe"), so a ground plane dark enough to look right on
    // paper renders as near-invisible once lit and tone-mapped — bumped
    // notably lighter than a literal dead-grass color would suggest so it
    // actually reads under the moon/hemisphere lighting. DoubleSide as a
    // safety net: `rotation.x = Math.PI / 2` below was previously the
    // negated sign, which (verified via the mesh's actual world matrix)
    // left the disc's normal facing *down* — invisible to every camera in
    // the scene, since they all sit above y=0. That's the root cause the
    // ground (and the dirt road riding on top of it) never showed up in
    // any screenshot regardless of light/exposure tuning.
    new THREE.MeshStandardMaterial({ color: '#3a4132', roughness: 1, side: THREE.DoubleSide }),
  );
  ground.rotation.x = Math.PI / 2;
  scene.add(ground);

  // Both roads are dressed, not just the church one: the scenic road needs a
  // trail through the new graveyard and back, or it reads as walking over
  // open ground.
  buildRoad(scene, 'direct');
  buildRoad(scene, 'work');
  buildGrass(scene, grassCount);
  buildSwamp(scene, models, tier);

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

  // Set dressing, real GLB or silhouette.
  const grave = models.gravestoneA?.scene ?? silhouette('grave');
  const graveB = models.gravestoneB?.scene ?? silhouette('graveb');
  const tree = models.treeA?.scene ?? silhouette('tree');
  const treeB = models.treeB?.scene ?? silhouette('tree');
  // Low tier (likely mobile): thin the heaviest set dressing to ~60% of
  // spots, keeping the ones nearest the path so the visible corridor still
  // reads as dressed. High tier keeps every PROP_SPOTS entry unchanged.
  const graveSpots = tier === 'low' ? nearestToPath(PROP_SPOTS.graves, 0.6) : PROP_SPOTS.graves;
  const treeSpots = tier === 'low' ? nearestToPath(PROP_SPOTS.trees, 0.6) : PROP_SPOTS.trees;
  const half = Math.ceil(graveSpots.length / 2);
  place(scene, normalizeProp(grave, 1.1), graveSpots.slice(0, half));
  place(scene, normalizeProp(graveB, 1.3), graveSpots.slice(half));
  place(scene, normalizeProp(tree, 6), treeSpots.filter((_, i) => i % 2 === 0));
  place(scene, normalizeProp(treeB, 7), treeSpots.filter((_, i) => i % 2 === 1));

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
    roofline: { y: roofHeightAt(0), z: roofZ, heightAt: roofHeightAt },
  };
}

function normalizeProp(objScene, targetHeight) {
  return normalize(objScene, targetHeight);
}
