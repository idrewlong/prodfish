import * as THREE from 'three';

// Normalised device coordinates measured against the CANVAS, not the window
// — the canvas is full-bleed today, but assuming that would break silently
// the moment anything is laid out around it.
export function pointerToNdc(clientX, clientY, rect) {
  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: -((clientY - rect.top) / rect.height) * 2 + 1,
  };
}

export function createPicker({ camera }) {
  const raycaster = new THREE.Raycaster();
  const point = new THREE.Vector2();
  let targets = [];

  return {
    setTargets(meshes) {
      targets = meshes ?? [];
    },
    // Returns the nearest hit that actually represents a choice, so stray
    // decorative geometry can never be "clicked".
    pick(ndc) {
      if (!targets.length) return null;
      point.set(ndc.x, ndc.y);
      raycaster.setFromCamera(point, camera);
      for (const hit of raycaster.intersectObjects(targets, true)) {
        let node = hit.object;
        while (node) {
          if (node.userData?.route) return node;
          node = node.parent;
        }
      }
      return null;
    },
  };
}
