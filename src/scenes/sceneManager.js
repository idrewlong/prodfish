import * as THREE from 'three';
import { createDepthPlane } from './depthPlane.js';
import { TIERS } from '../device.js';

export const PLANE_Z = { exterior: 0, threshold: -12, interior: -40 };

export function initScene({ canvas, state, tier }) {
  const settings = TIERS[tier];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  renderer.setClearColor('#000000', 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.dprCap));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, state.camZ);

  const planes = {};
  for (const name of Object.keys(PLANE_Z)) {
    const tex = new THREE.Texture(); // replaced via setTextures
    const plane = createDepthPlane({
      colorTex: tex,
      depthTex: tex,
      size: 16,
      segments: settings.segments,
      depthScale: name === 'interior' ? 3.5 : 2.5,
    });
    plane.position.z = PLANE_Z[name];
    scene.add(plane);
    planes[name] = plane;
  }

  function setTextures(name, colorTex, depthTex) {
    colorTex.colorSpace = THREE.SRGBColorSpace;
    const u = planes[name].material.uniforms;
    u.uMap.value = colorTex;
    u.uDepth.value = depthTex;
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();
  function render() {
    const t = clock.getElapsedTime();
    // ambient sway — the scene breathes even when idle
    camera.position.x = Math.sin(t * 0.28) * 0.14 * state.swayAmp;
    camera.position.y = state.camY + Math.sin(t * 0.19) * 0.08 * state.swayAmp;
    camera.position.z = state.camZ;
    camera.lookAt(0, camera.position.y * 0.5, state.camZ - 20);

    planes.exterior.material.uniforms.uOpacity.value = state.exteriorOpacity;
    planes.exterior.material.uniforms.uFog.value = state.fog;
    planes.threshold.material.uniforms.uOpacity.value = state.thresholdOpacity;
    planes.interior.material.uniforms.uOpacity.value = state.interiorOpacity;

    renderer.render(scene, camera);
  }

  return { renderer, scene, camera, planes, render, setTextures };
}
