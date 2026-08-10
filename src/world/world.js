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
function normalize(gltfScene, targetHeight) {
  const root = new THREE.Group();
  root.add(gltfScene);
  const box = new THREE.Box3().setFromObject(gltfScene);
  const size = box.getSize(new THREE.Vector3());
  const scale = targetHeight / size.y;
  gltfScene.scale.setScalar(scale);
  box.setFromObject(gltfScene);
  const center = box.getCenter(new THREE.Vector3());
  gltfScene.position.x -= center.x;
  gltfScene.position.z -= center.z;
  gltfScene.position.y -= box.min.y;
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

  // Moonlight from behind the chapel + a whisper of ambient.
  const moon = new THREE.DirectionalLight('#b9c4d6', 0.5);
  moon.position.set(-6, 18, -30);
  scene.add(moon, new THREE.AmbientLight('#1a2028', 0.6));

  // Chapel: scaled to ~9m tall, doorway on the z=0 plane facing +z.
  // If the model is somehow null (dev only), a box shell keeps the world testable.
  let chapelRoot;
  if (models.church) {
    chapelRoot = normalize(models.church.scene, 9);
    // Push back so the front facade sits just behind the doorway plane.
    const box = new THREE.Box3().setFromObject(chapelRoot);
    chapelRoot.position.z = -(box.max.z - 0.4);
    // Hide any authored door mesh — we hinge our own for scroll control.
    chapelRoot.traverse((o) => {
      if (o.isMesh && /door/i.test(o.name)) o.visible = false;
    });
  } else {
    chapelRoot = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(8, 9, 14),
      new THREE.MeshStandardMaterial({ color: '#0d0f11', roughness: 1, side: THREE.BackSide }),
    );
    shell.position.set(0, 4.5, -7);
    chapelRoot.add(shell);
  }
  scene.add(chapelRoot);

  // Our own hinged door in the doorway plane (hinge on the left jamb).
  const door = new THREE.Group();
  door.position.set(-0.75, 0, 0);
  const leaf = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 2.6, 0.09),
    new THREE.MeshStandardMaterial({ color: '#171310', roughness: 0.9 }),
  );
  leaf.position.set(0.75, 1.3, 0);
  door.add(leaf);
  scene.add(door);

  // Red light bleeding through the doorway from inside.
  const doorGlow = new THREE.PointLight('#c1170f', 8, 9, 2);
  doorGlow.position.set(0, 1.6, -1.2);
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

  // Altar anchor: where the cross + altar light mount (interior back wall).
  const altarAnchor = new THREE.Object3D();
  altarAnchor.position.set(0, 2.4, -12.3);
  scene.add(altarAnchor);

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
