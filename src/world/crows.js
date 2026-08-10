import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { crowPhase } from './events.js';

// Crows perch on the roofline and scatter along per-crow escape curves as
// crowT sweeps 0->1. All motion derives from crowT, so scrubbing back
// re-perches them.
export function createCrows({ scene, gltf, roofline, count }) {
  const crows = [];
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const perch = new THREE.Vector3(
      side * (0.6 + (i % 3) * 0.9),
      roofline.y,
      roofline.z + (i - count / 2) * 0.7,
    );
    const escape = new THREE.CatmullRomCurve3([
      perch,
      perch.clone().add(new THREE.Vector3(side * 2.5, 2.2, 2.5)),
      perch.clone().add(new THREE.Vector3(side * 7, 7, 6)),
      perch.clone().add(new THREE.Vector3(side * 14, 12, 10)),
    ]);

    let obj;
    let mixer = null;
    let clipDuration = 0;
    if (gltf) {
      obj = skeletonClone(gltf.scene); // safe clone for skinned meshes
      if (gltf.animations.length) {
        mixer = new THREE.AnimationMixer(obj);
        const clip = gltf.animations[0];
        clipDuration = clip.duration;
        mixer.clipAction(clip).play();
      }
      // Sized to read clearly against the roofline silhouette from the
      // approach path — small perching birds get lost in the fog at true
      // scale, so this leans larger than a real crow. task-12: bumped again
      // (0.9 -> 1.6) after confirming via a close-range debug shot that the
      // model itself renders correctly but was too small a silhouette to
      // read at ~35-40m approach distance against the sky.
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      obj.scale.setScalar(1.6 / Math.max(size.x, size.y, size.z));
      // task-12: the source GLB's material comes through with
      // transparent=true; combined with an alpha channel that the
      // compression pipeline (Task 4/5's meshoptimizer/KTX2 step) appears to
      // have zeroed out, every crow rendered fully invisible against the sky
      // regardless of scale or lighting — confirmed by dumping the live
      // material (opacity:1, transparent:true, mapImage loaded fine, but
      // nothing appeared on screen at the perch's correctly-projected screen
      // coordinates). The birds are meant to read as solid silhouettes, not
      // translucent, so force opaque rendering at runtime rather than
      // depend on a broken per-pixel alpha channel.
      // task-12: crows perch ~35-40m out at the roofline where FogExp2
      // blends geometry color toward the fog/sky color (which is a similar
      // dark navy to the crow's own near-black plumage) -- on top of the
      // transparency bug above, this was crushing what little contrast the
      // silhouette had left, even fully opaque and at a bumped scale.
      // Exempting crows from fog keeps them a crisp dark silhouette against
      // the sky/church at any distance, matching how the moon/hemisphere
      // lights already let far graves and trees read through the fog.
      obj.traverse((o) => {
        if (o.isMesh && o.material) {
          o.material.transparent = false;
          o.material.depthWrite = true;
          o.material.fog = false;
        }
      });
    } else {
      // Fallback: a small dark cone reads as a bird silhouette in fog.
      obj = new THREE.Mesh(
        new THREE.ConeGeometry(0.09, 0.3, 5),
        new THREE.MeshStandardMaterial({ color: '#05060a', roughness: 1 }),
      );
      obj.rotation.x = Math.PI / 2;
    }
    obj.position.copy(perch);
    scene.add(obj);
    crows.push({ obj, mixer, clipDuration, perch, escape });
  }

  const tmp = new THREE.Vector3();
  return {
    update(crowT, elapsed) {
      crows.forEach((c, i) => {
        const phase = crowPhase(crowT, i);
        if (phase <= 0) {
          c.obj.position.copy(c.perch);
          c.obj.visible = true;
          if (c.mixer) c.mixer.setTime(0);
          return;
        }
        c.obj.visible = phase < 0.98;
        c.escape.getPointAt(Math.min(phase, 1), tmp);
        c.obj.position.copy(tmp);
        // Face flight direction.
        const ahead = c.escape.getPointAt(Math.min(phase + 0.02, 1));
        c.obj.lookAt(ahead);
        // Scrub the flap cycle off phase + a wing-beat off elapsed time.
        if (c.mixer) {
          const flap = (phase * 6 + elapsed * 0.6 + i * 0.3) % 1;
          c.mixer.setTime(flap * c.clipDuration);
        }
      });
    },
  };
}
