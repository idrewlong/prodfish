import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { crowPhase } from './events.js';

// Crows perch on the roofline and scatter along per-crow escape curves as
// crowT sweeps 0->1. All motion derives from crowT, so scrubbing back
// re-perches them.
// `stonePerch` is the real top surface of the monument the lone crow stands
// on, handed in by sceneManager from buildMonuments(). Optional: without it
// the bird falls back to its old fixed spot rather than disappearing. NOT
// named `perch` — the roofline loop below has its own local `perch`, and two
// different perches under one name is how the bird got lost the first time.
export function createCrows({ scene, gltf, roofline, count, stonePerch = null }) {
  // One bird does not scatter. It sits on a stone by the road and turns its
  // head to follow the camera, which is far more unsettling than the whole
  // flock leaving -- and it is still there on the way back.
  let watcher = null;
  // Resting height, kept so the idle bob below is a wobble around the perch
  // rather than a jump back to a hardcoded number.
  let watcherBaseY = 1.35;
  // ...and one crosses the moon, far off, on its own slow loop. Both are
  // deliberately outside the scatter set below.
  let distant = null;
  const crows = [];
  // The source GLB's own origin is NOT at the bird's feet — measured
  // empirically while lowering the perch onto the real roof (see
  // roofline.heightAt below): at our target 1.6m scale the rig's origin
  // sits ~1.4m above the actual mesh. That offset was invisible while
  // crows floated near the spire (a stray meter didn't read against a huge
  // silhouette height), but once the perch height is corrected to the true
  // roof surface it silently buries the whole bird under the roof mesh
  // (confirmed: a raycast straight through the perch point hit the church
  // roof mesh, not the crow, before this fix). Same scale/offset for every
  // clone of the same source, so measure once and reuse.
  let crowScale = 1;
  let footOffset = 0;
  // Kept out of the block below because the lone crow needs them too: it is
  // scaled differently (0.9 vs 1.6) and so has a different foot offset, and
  // deriving its own from the same probe is what keeps the two in step.
  let probeMinY = 0;
  let probeMax = 1;
  if (gltf) {
    const probeBox = new THREE.Box3().setFromObject(gltf.scene);
    const probeSize = probeBox.getSize(new THREE.Vector3());
    probeMax = Math.max(probeSize.x, probeSize.y, probeSize.z);
    probeMinY = probeBox.min.y;
    crowScale = 1.6 / probeMax;
    footOffset = -probeMinY * crowScale;
  }
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const perchX = side * (0.6 + (i % 3) * 0.9);
    // Fix (roofline pass): roofline.heightAt raycasts the real roof surface
    // at this x (see world.js) so the perch sits on the actual roofline edge
    // instead of the old fixed y that floated far above the roof near the
    // tower's full height. footOffset (above) keeps the bird's feet, not its
    // rig origin, at that surface.
    const perchY = (roofline.heightAt ? roofline.heightAt(perchX) : roofline.y) + footOffset + 0.03;
    const perch = new THREE.Vector3(
      perchX,
      perchY,
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
      obj.scale.setScalar(crowScale);
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

  if (gltf) {
    watcher = skeletonClone(gltf.scene);
    const watcherScale = 0.9 / probeMax;
    watcher.scale.setScalar(watcherScale);

    // It used to sit at a hardcoded (3.1, 1.35, 18.4). The 1.35 was not
    // arbitrary — it is exactly STONE_HEIGHT in monuments.js, so this was
    // written to stand on a monument. But the x/z was never lined up with
    // one: the nearest stone is at (3.81, 17.82), 0.92m away, so the bird
    // hovered at perching height over open ground with nothing under it.
    //
    // Now it takes the real top surface of the real stone, and adds its own
    // foot offset — the source GLB's origin is NOT at the bird's feet (see
    // the probe above), so without this it would sit buried to the ankles or
    // hovering again. Exactly what the roofline perches already do; this one
    // was simply never given the same treatment.
    const watcherFoot = -probeMinY * watcherScale;
    watcherBaseY = (stonePerch ? stonePerch.y : 1.35) + watcherFoot;
    watcher.position.set(
      stonePerch ? stonePerch.x : 3.1,
      watcherBaseY,
      stonePerch ? stonePerch.z : 18.4,
    );
    // Named so the __raycastForward/__raycastNDC debug helpers in
    // sceneManager report it by name instead of as an anonymous 'Group'.
    watcher.name = 'crow-watcher';
    scene.add(watcher);

    distant = skeletonClone(gltf.scene);
    distant.scale.setScalar(watcherScale);
    scene.add(distant);
  }

  const tmp = new THREE.Vector3();
  const headLook = new THREE.Vector3();
  return {
    update(crowT, elapsed, cameraPos) {
      if (watcher && cameraPos) {
        // Track the camera, but only in yaw: a bird swivelling on every axis
        // reads as a broken puppet.
        headLook.set(cameraPos.x, watcher.position.y, cameraPos.z);
        watcher.lookAt(headLook);
        watcher.position.y = watcherBaseY + Math.sin(elapsed * 1.6) * 0.02;
      }
      if (distant) {
        // A long, slow pass across the sky near the moon.
        const u = (elapsed * 0.035) % 1;
        distant.position.set(-40 + u * 80, 26 - Math.sin(u * Math.PI) * 4, -30);
        distant.rotation.y = Math.PI / 2;
        distant.rotation.z = Math.sin(elapsed * 5) * 0.25;
      }

      crows.forEach((c, i) => {
        const phase = crowPhase(crowT, i);
        if (phase <= 0) {
          // Idle perched motion: elapsed-time driven (never crowT/scrub — the
          // scatter itself must stay purely scrub-driven, per spec) so the
          // birds read as alive rather than static props before takeoff. A
          // low-amplitude sine bob plus a brief wing-ruffle burst every few
          // seconds, staggered per-bird so they don't move in unison.
          const bob = Math.sin(elapsed * 1.6 + i * 1.7) * 0.035;
          tmp.copy(c.perch);
          tmp.y += bob;
          c.obj.position.copy(tmp);
          c.obj.visible = true;
          if (c.mixer && c.clipDuration) {
            const period = 4.5 + (i % 3) * 0.8;
            const cyclePos = (elapsed + i * 0.9) % period;
            const ruffleWindow = 0.5;
            if (cyclePos < ruffleWindow) {
              const eased = Math.sin((cyclePos / ruffleWindow) * Math.PI); // 0 -> 1 -> 0
              c.mixer.setTime(eased * c.clipDuration * 0.3);
            } else {
              c.mixer.setTime(0);
            }
          }
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
