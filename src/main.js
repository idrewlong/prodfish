import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createState } from './choreography.js';
import { detectTier } from './device.js';
import { initScene } from './scenes/sceneManager.js';
import { createAssetLoader } from './world/assets.js';
import { T_DOOR, T_GATE } from './world/path.js';
import { CREDITS, BIO, CATALOG_URL, SOCIALS } from './content/portfolio.js';
import { initScroll } from './scroll.js';
import { buildTimeline } from './timeline.js';
import { createPicker, pointerToNdc } from './picking.js';
import { ENGRAVED_STONE_INK, ENGRAVED_LIT } from './world/engraving.js';

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

async function loadModels() {
  const load = createAssetLoader();
  const [church, crow, cross, gravestoneA, gravestoneB, treeA, treeB, stones, rider, bike] = await Promise.all([
    load.required('/models/church.glb').catch((e) => {
      console.error('chapel failed to load', e);
      return null; // world.js builds a shell; loading screen still clears
    }),
    load.optional('/models/crow.glb'),
    load.optional('/models/cross.glb'),
    load.optional('/models/gravestone-a.glb'),
    load.optional('/models/gravestone-b.glb'),
    load.optional('/models/tree-a.glb'),
    load.optional('/models/tree-b.glb'),
    load.optional('/models/grave-stones.glb'),
    load.optional('/models/rider.glb'),
    load.optional('/models/motorcycle.glb'),
  ]);
  return { church, crow, cross, gravestoneA, gravestoneB, treeA, treeB, stones, rider, bike };
}

// One picker, one kind of target: a carved stone opens its track.
function attachStoneClicks(app, canvas) {
  const picker = createPicker({ camera: app.camera });
  picker.setTargets(app.creditStones);

  let hovered = null;
  const setHover = (stone) => {
    if (hovered === stone) return;
    if (hovered) hovered.userData.textMesh.material.color.setHex(ENGRAVED_STONE_INK);
    hovered = stone;
    if (hovered) hovered.userData.textMesh.material.color.setHex(ENGRAVED_LIT);
    canvas.style.cursor = hovered ? 'pointer' : '';
  };

  const ndcFor = (e) => pointerToNdc(e.clientX, e.clientY, canvas.getBoundingClientRect());

  // Hover is resolved at most once per frame: pointermove fires far faster
  // than the scene renders, and a raycast per event is wasted work.
  let queued = null;
  canvas.addEventListener('pointermove', (e) => { queued = ndcFor(e); });
  gsap.ticker.add(() => {
    if (!queued) return;
    setHover(picker.pick(queued));
    queued = null;
  });

  canvas.addEventListener('click', (e) => {
    const hit = picker.pick(ndcFor(e));
    if (hit?.userData?.href) window.open(hit.userData.href, '_blank', 'noopener');
  });
}

async function boot() {
  const state = createState();
  const tier = detectTier();
  const models = await loadModels();
  const app = initScene({ canvas: document.getElementById('scene'), state, tier, models });
  document.body.classList.add('ready');

  initScroll();
  buildTimeline(state);

  // The song stones along the approach open their track when clicked. This
  // is the only in-world interaction left now that the signpost is gone.
  attachStoneClicks(app, document.getElementById('scene'));

  gsap.ticker.add(() => app.render());
}

// Reduced motion: one static framed view of the approach, no scroll scrub.
async function bootStatic() {
  const state = createState();
  state.pathT = 0.32;
  state.swayAmp = 0;
  state.fireflies = 0.6;
  const models = await loadModels();
  const app = initScene({ canvas: document.getElementById('scene'), state, tier: 'low', models });
  document.body.classList.add('ready');
  let frames = 0;
  const tick = () => {
    app.render();
    if (++frames > 5) gsap.ticker.remove(tick);
  };
  gsap.ticker.add(tick);
}

// ?debug: slider drives the journey without scrolling — for calibration.
async function bootDebug() {
  const state = createState();
  const models = await loadModels();
  const app = initScene({ canvas: document.getElementById('scene'), state, tier: 'high', models });
  document.body.classList.add('ready');
  document.getElementById('blackout').style.opacity = '0';
  document.getElementById('hero').style.display = 'none';

  const slider = document.createElement('input');
  Object.assign(slider, { type: 'range', min: 0, max: 1000, value: 0 });
  slider.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);width:60%;z-index:10';
  document.body.appendChild(slider);
  slider.addEventListener('input', () => {
    const p = slider.value / 1000;
    state.pathT = p;
    state.doorT = gsap.utils.clamp(0, 1, (p - (T_DOOR - 0.1)) * 10);
    state.crowT = gsap.utils.clamp(0, 1, (p - T_GATE + 0.05) * 5);
    state.candleT = gsap.utils.clamp(0, 1, (p - T_DOOR) * 5);
    state.crossGlow = gsap.utils.clamp(0, 1, (p - T_DOOR + 0.05) * 6);
  });
  gsap.ticker.add(() => app.render());
}

// Boot failures (bad model URL, WebGL init throwing mid-setup, etc.) were
// previously fire-and-forget: the #loading overlay stays visible forever
// with no signal anything went wrong. Surface it instead, keeping the
// overlay up rather than letting the page look permanently stuck loading.
function bootFailed(err) {
  console.error('boot failed', err);
  const loading = document.getElementById('loading');
  if (!loading) return;
  loading.textContent = 'something went wrong — refresh to retry';
  // Inline styles win over the .reduced/.no-webgl CSS rules that otherwise
  // hide #loading in those modes, so the message is visible regardless of
  // which boot path failed.
  loading.style.display = 'flex';
  loading.style.opacity = '1';
}

// Fills the static section from the same content module the carved stone
// and plaster use, so the two presentations can never drift apart. Runs
// unconditionally -- the section is CSS-hidden unless a fallback class is
// set, which keeps this to one code path.
function fillStaticPortfolio() {
  const list = document.querySelector('.work-list');
  const bio = document.querySelector('.work-bio');
  const socialNav = document.querySelector('.work-socials');
  const catalog = document.querySelector('.work-catalog');
  if (!list || !bio || !socialNav || !catalog) return;
  for (const c of CREDITS) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = c.url;
    a.target = '_blank';
    a.rel = 'noopener';
    const artist = document.createElement('span');
    artist.className = 'work-artist';
    artist.textContent = c.artist;
    a.append(artist, document.createTextNode(c.track));
    li.append(a);
    list.append(li);
  }
  bio.textContent = BIO;
  for (const s of SOCIALS) {
    const a = document.createElement('a');
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = s.label;
    socialNav.append(a);
  }
  catalog.href = CATALOG_URL;
}

fillStaticPortfolio();

if (prefersReduced) document.body.classList.add('reduced');

if (!webglAvailable()) {
  document.body.classList.add('no-webgl');
} else if (new URLSearchParams(location.search).has('debug')) {
  bootDebug().catch(bootFailed);
} else if (prefersReduced) {
  bootStatic().catch(bootFailed);
} else {
  boot().catch(bootFailed);
}
