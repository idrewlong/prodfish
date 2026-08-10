import * as THREE from 'three';
import { TIERS } from '../device.js';
import { positionAt, targetAt } from '../world/path.js';
import { buildWorld } from '../world/world.js';
import { createCrows } from '../world/crows.js';
import { createCandles } from '../world/candles.js';
import { doorAngle } from '../world/events.js';
import { createFireflies } from './particles.js';
import { createPost } from './post.js';

export function initScene({ canvas, state, tier, models }) {
  const settings = TIERS[tier];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  renderer.setClearColor('#050607', 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.dprCap));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#050607');
  scene.fog = new THREE.FogExp2('#050607', state.fog);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 130);

  const world = buildWorld({ scene, models });
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
    // breathes even when scroll is idle.
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
