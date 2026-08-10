import * as THREE from 'three';
import { gsap } from 'gsap';
import { createState } from './choreography.js';
import { detectTier } from './device.js';
import { initScene } from './scenes/sceneManager.js';
import { makeExterior, makeThreshold, makeInterior } from './scenes/placeholders.js';
import { initScroll } from './scroll.js';
import { buildTimeline } from './timeline.js';

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  initScroll();
  buildTimeline(state);
  gsap.ticker.add(() => app.render());
}

function bootStatic() {
  const state = createState();
  state.camZ = 8;
  state.swayAmp = 0;
  state.exteriorOpacity = 1;
  state.fog = 0.25;
  const app = initScene({ canvas: document.getElementById('scene'), state, tier: 'low' });
  const sources = { exterior: makeExterior(), threshold: makeThreshold(), interior: makeInterior() };
  for (const [name, { color, depth }] of Object.entries(sources)) {
    app.setTextures(name, new THREE.CanvasTexture(color), new THREE.CanvasTexture(depth));
  }
  // render a few frames so textures upload, then stop
  let frames = 0;
  const tick = () => {
    app.render();
    if (++frames > 5) gsap.ticker.remove(tick);
  };
  gsap.ticker.add(tick);
}

if (new URLSearchParams(location.search).has('debug')) {
  debugScenes();
} else if (!webglAvailable()) {
  document.body.classList.add('no-webgl');
} else if (prefersReduced) {
  document.body.classList.add('reduced');
  bootStatic();
} else {
  boot();
}
