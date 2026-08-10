import * as THREE from 'three';
import { TIERS } from '../device.js';
import { positionAt, targetAt } from '../world/path.js';
import { buildWorld, NIGHT_SKY } from '../world/world.js';
import { createCrows } from '../world/crows.js';
import { createCandles } from '../world/candles.js';
import { doorAngle } from '../world/events.js';
import { createFireflies } from './particles.js';
import { createPost } from './post.js';

export function initScene({ canvas, state, tier, models }) {
  const settings = TIERS[tier];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  renderer.setClearColor(NIGHT_SKY, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.dprCap));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // task-12: previously boosted to 2.3 while fighting a missing gamma-encode
  // bug in the post-processing final pass (see post.js) that made every
  // light bump look ineffective. With that fixed, 1.4 is plenty.
  renderer.toneMappingExposure = 1.4;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(NIGHT_SKY);
  scene.fog = new THREE.FogExp2(NIGHT_SKY, state.fog);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 130);

  const world = buildWorld({ scene, models, grassCount: settings.grass });
  const crows = createCrows({
    scene, gltf: models.crow, roofline: world.roofline, count: settings.crows,
  });
  const candles = createCandles({
    scene,
    altarAnchor: world.altarAnchor,
    crossGltf: models.cross,
    maxLights: settings.candleLights,
  });

  const fireflies = createFireflies(settings.particles);
  scene.add(fireflies);

  const post = createPost(renderer, scene, camera);

  if (window.__DEBUG_CHAPEL__) {
    window.__scene = scene;
    window.__camera = camera;
    window.__world = world;
    const ancestorsVisible = (o) => {
      let n = o;
      while (n) {
        if (!n.visible) return false;
        n = n.parent;
      }
      return true;
    };
    window.__raycastNDC = (ndcX, ndcY) => {
      const raycaster = new THREE.Raycaster();
      raycaster.far = 60;
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const hits = raycaster.intersectObjects(scene.children, true).filter((h) => ancestorsVisible(h.object));
      if (!hits.length) return null;
      const h = hits[0];
      return { name: h.object.name || h.object.type, distance: h.distance, point: h.point.toArray() };
    };
    window.__raycastForward = () => {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const raycaster = new THREE.Raycaster(camera.position.clone(), dir, 0.05, 40);
      const hits = raycaster.intersectObjects(scene.children, true);
      return hits.slice(0, 8).map((h) => ({
        name: h.object.name || h.object.type,
        distance: h.distance,
        point: h.point.toArray(),
        material: h.object.material?.type,
        color: h.object.material?.color?.getHexString?.(),
        visible: h.object.visible,
      }));
    };
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    post.composer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();
  const look = new THREE.Vector3();
  function render() {
    const t = clock.getElapsedTime();

    // Camera rides the path; ambient sway layered on top so the scene
    // breathes even when scroll is idle. __DEBUG_CHAPEL__ builds may set
    // window.__camOverride = {pos:[x,y,z], look:[x,y,z]} to freely inspect
    // geometry outside the path during calibration.
    if (window.__DEBUG_CHAPEL__ && window.__camOverride) {
      const { pos: p, look: lk } = window.__camOverride;
      camera.position.set(p[0], p[1], p[2]);
      camera.lookAt(lk[0], lk[1], lk[2]);
      scene.fog.density = state.fog;
      crows.update(state.crowT, t);
      candles.update(state.candleT, state.crossGlow, t);
      fireflies.material.uniforms.uTime.value = t;
      fireflies.material.uniforms.uOpacity.value = state.fireflies;
      post.setTime(t);
      post.composer.render();
      return;
    }
    const pos = positionAt(state.pathT);
    camera.position.set(
      pos.x + Math.sin(t * 0.28) * 0.14 * state.swayAmp,
      pos.y + Math.sin(t * 0.19) * 0.08 * state.swayAmp,
      pos.z,
    );
    look.copy(targetAt(state.pathT));
    camera.lookAt(look);

    world.door.rotation.y = doorAngle(state.doorT);
    scene.fog.density = state.fog;

    crows.update(state.crowT, t);
    candles.update(state.candleT, state.crossGlow, t);

    fireflies.material.uniforms.uTime.value = t;
    fireflies.material.uniforms.uOpacity.value = state.fireflies;
    post.setTime(t);
    post.composer.render();
  }

  return { renderer, scene, camera, render };
}
