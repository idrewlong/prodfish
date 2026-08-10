import * as THREE from 'three';
import { gsap } from 'gsap';
import { createState } from './choreography.js';
import { detectTier } from './device.js';
import { initScene } from './scenes/sceneManager.js';
import { makeExterior, makeThreshold, makeInterior } from './scenes/placeholders.js';

function debugScenes() {
  document.body.style.overflow = 'auto';
  for (const make of [makeExterior, makeThreshold, makeInterior]) {
    const { color, depth } = make();
    for (const c of [color, depth]) {
      c.style.cssText = 'width:320px;height:320px;display:inline-block;margin:4px;position:relative;z-index:10';
      document.body.appendChild(c);
    }
  }
}

function boot() {
  const state = createState();
  const tier = detectTier();
  const app = initScene({ canvas: document.getElementById('scene'), state, tier });

  const sources = { exterior: makeExterior(), threshold: makeThreshold(), interior: makeInterior() };
  for (const [name, { color, depth }] of Object.entries(sources)) {
    app.setTextures(name, new THREE.CanvasTexture(color), new THREE.CanvasTexture(depth));
  }

  // temporary: show exterior immediately until the timeline exists (Task 7)
  state.exteriorOpacity = 1;
  document.getElementById('blackout').style.opacity = '0';

  gsap.ticker.add(() => app.render());
}

if (new URLSearchParams(location.search).has('debug')) debugScenes();
else boot();
