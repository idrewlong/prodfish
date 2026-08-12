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
import { createPanels } from './panels.js';
import { createAmbience, duckLevel } from './audio.js';
import { JOURNEY_VH, journeyDistancePx } from './journey.js';

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
  const [church, crow, cross, gravestoneA, gravestoneB, treeA, treeB, stones, bike] = await Promise.all([
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
    load.optional('/models/motorcycle.glb'),
  ]);
  return { church, crow, cross, gravestoneA, gravestoneB, treeA, treeB, stones, bike };
}


async function boot() {
  const state = createState();
  const tier = detectTier();
  const models = await loadModels();
  const app = initScene({
    canvas: document.getElementById('scene'),
    state, tier, models,
    onThunder: () => ambience.thunder(),
    onDoor: () => ambience.creak(),
    onCandle: () => ambience.candle(),
    onStep: (n) => ambience.step(n),
  });
  document.body.classList.add('ready');

  // The document's height and the timeline's span must agree, or the
  // journey either runs out early or never finishes. JOURNEY_VH is the one
  // source of truth; the CSS value is only a sensible pre-boot default.
  document.getElementById('scroll-track').style.height = `${JOURNEY_VH}vh`;

  initScroll();
  buildTimeline(state);

  // Duck the swamp once the beats arrive, so the track is not competing with
  // crickets. Spanning the same fixed journey distance as the master
  // timeline, so `progress` here means the same thing it does there.
  ScrollTrigger.create({
    trigger: '#scroll-track',
    start: 'top top',
    end: () => `+=${journeyDistancePx(window.innerHeight)}`,
    onUpdate: (self) => ambience.setDuck(duckLevel(self.progress)),
  });

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

// Fills the credits and about panels from the content module. The carved
// song stones along the approach read from the same source, so the two can
// never drift apart.
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

// The panels are the site's only navigation, so they are wired up
// unconditionally — including on the reduced-motion and no-WebGL paths,
// which never boot the 3D scene but still need the catalog and the bio.
const panelRoot = document.querySelector('.panels');
if (panelRoot) createPanels(panelRoot);

// One ambience for the page, shared with the 3D scene so thunder can follow
// its own lightning. Wired up outside boot() because the reduced-motion and
// no-WebGL paths deserve the swamp too.
const ambience = createAmbience();
const soundBtn = document.getElementById('sound');

const volumeSlider = document.getElementById('volume');

function markSound(on) {
  document.body.classList.toggle('sound-on', on);
  if (!soundBtn) return;
  soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  soundBtn.setAttribute('aria-label', on ? 'turn ambient sound off' : 'turn ambient sound on');
}

if (volumeSlider) {
  ambience.setVolume(volumeSlider.value / 100);
  volumeSlider.addEventListener('input', () => ambience.setVolume(volumeSlider.value / 100));
  // Dragging the slider must not also count as the "first interaction" that
  // starts the sound, or grabbing it would fire audio before it is aimed.
  document.getElementById('volume-row')?.addEventListener('pointerdown', (e) => e.stopPropagation());
}

// Every browser refuses to start audio until the visitor has interacted with
// the page -- there is no way to truly autoplay, and a site that tried would
// simply be silent. So it starts itself at the FIRST interaction of any
// kind, including the first scroll, rather than waiting to be found in the
// corner. The toggle remains for turning it back off.
let soundArmed = true;
async function startAmbience() {
  if (!soundArmed || ambience.running) return;
  soundArmed = false;
  await ambience.start();
  markSound(true);
}
for (const evt of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll']) {
  window.addEventListener(evt, startAmbience, { once: true, passive: true });
}

soundBtn?.addEventListener('click', async (e) => {
  e.stopPropagation();
  if (ambience.running) {
    ambience.stop();
    soundArmed = false; // an explicit "off" must not be undone by the next scroll
    markSound(false);
  } else {
    soundArmed = true;
    await startAmbience();
  }
});

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
