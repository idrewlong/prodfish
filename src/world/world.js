import * as THREE from 'three';
import { positionAt } from './path.js';

// Hand-placed prop spots [x, z, rotY, scale] flanking the path's S-curve.
// Deterministic (no Math.random) so the corridor-clearance test is real.
export const PROP_SPOTS = {
  graves: [
    [-3.2, 34, 0.3, 1], [3.6, 31, -0.2, 0.9], [-2.8, 27, 0.8, 1.1],
    [4.2, 24, -0.5, 1], [-4.5, 21, 0.1, 0.85], [3.4, 17, 0.6, 1],
    [-3.0, 14, -0.4, 0.95], [3.8, 12, 0.2, 1.05], [-3.6, 8.5, -0.7, 1],
    [3.1, 6.5, 0.4, 0.9],
  ],
  trees: [
    [-6.5, 38, 0, 1.1], [7, 33, 1.2, 1], [-7.5, 26, 2.1, 0.9],
    [6.8, 20, 0.4, 1.2], [-6.2, 13, 2.8, 1], [7.2, 8, 1.7, 0.95],
  ],
};

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

export function buildWorld({ scene, models }) {
  // Ground: a big dark disc; fog swallows the edge.
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(90, 48),
    new THREE.MeshStandardMaterial({ color: '#070a08', roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Moonlight from behind the chapel + a hemisphere fill so silhouettes read
  // in the fog without flattening the southern-gothic near-dark mood. Pushed
  // notably brighter in task-12 after repeated screenshot feedback that the
  // graveyard, trees, and church were all too dark to read.
  const moon = new THREE.DirectionalLight('#b9c4d6', 5.5);
  moon.position.set(-6, 18, -30);
  scene.add(moon, new THREE.HemisphereLight('#3a4a5f', '#1a140f', 2.4));

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

  // Our own hinged door in the doorway plane (hinge on the left jamb). Sized
  // to the real modeled opening (~2.0m wide x ~2.48m tall at
  // CHAPEL_TARGET_HEIGHT — see task-12-report.md), inset slightly so the
  // leaf clears the stone jambs either side.
  const door = new THREE.Group();
  door.position.set(-1.0, 0, 0);
  const leaf = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 2.4, 0.09),
    new THREE.MeshStandardMaterial({ color: '#171310', roughness: 0.9 }),
  );
  leaf.position.set(0.95, 1.2, 0);
  door.add(leaf);
  scene.add(door);

  // Red light bleeding through the doorway from inside, placed at the
  // reveal depth (the recessed inner wall plane, not the outer face).
  const doorGlow = new THREE.PointLight('#c1170f', 10, 11, 2);
  doorGlow.position.set(0, 1.8, -1.6);
  scene.add(doorGlow);

  // Set dressing, real GLB or silhouette.
  const grave = models.gravestoneA?.scene ?? silhouette('grave');
  const graveB = models.gravestoneB?.scene ?? silhouette('graveb');
  const tree = models.treeA?.scene ?? silhouette('tree');
  const treeB = models.treeB?.scene ?? silhouette('tree');
  const half = Math.ceil(PROP_SPOTS.graves.length / 2);
  place(scene, normalizeProp(grave, 1.1), PROP_SPOTS.graves.slice(0, half));
  place(scene, normalizeProp(graveB, 1.3), PROP_SPOTS.graves.slice(half));
  place(scene, normalizeProp(tree, 6), PROP_SPOTS.trees.filter((_, i) => i % 2 === 0));
  place(scene, normalizeProp(treeB, 7), PROP_SPOTS.trees.filter((_, i) => i % 2 === 1));

  // Altar anchor: where the cross + altar light mount, on the chapel's own
  // interior back wall (just in front of it, facing the aisle) rather than a
  // hardcoded guess — derived from the actual (post-alignment) chapel bbox
  // so it tracks CHAPEL_Z_STRETCH and any future model swap.
  const interiorBack = new THREE.Box3().setFromObject(chapelRoot).min.z;
  const altarAnchor = new THREE.Object3D();
  altarAnchor.position.set(0, 2.6, interiorBack + 0.35);
  scene.add(altarAnchor);

  // Always-on, dim interior fill: the moon/hemisphere read the exterior and
  // reach a little way through the open door, but the nave depths (before
  // any candles are lit) would otherwise sit fully black — a windowless box
  // as far as scene lighting is concerned, since the walls block the
  // exterior lights' contribution once inside. Two soft warm pools, roughly
  // mid-aisle and at the altar, keep pews and the far wall just legible.
  const interiorFillA = new THREE.PointLight('#5a4636', 3.2, 9, 2);
  interiorFillA.position.set(0, 3.2, interiorBack * 0.4);
  scene.add(interiorFillA);
  const interiorFillB = new THREE.PointLight('#5a4636', 2.6, 8, 2);
  interiorFillB.position.set(0, 3, interiorBack + 2.5);
  scene.add(interiorFillB);

  const chapelBox = new THREE.Box3().setFromObject(chapelRoot);
  return {
    chapelRoot,
    door,
    altarAnchor,
    roofline: { y: chapelBox.max.y - 0.2, z: chapelBox.min.z * 0.25 },
  };
}

function normalizeProp(objScene, targetHeight) {
  return normalize(objScene, targetHeight);
}
