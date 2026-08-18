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
import { journeyDistancePx, journeyTrackPx, viewportBasis, resetViewportBasis } from './journey.js';

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Paints the loading screen's progress bar. Kept separate from the loader so
// the reduced-motion and debug paths get the same feedback for free.
function showProgress(fraction) {
  const bar = document.querySelector('#loading .load-bar-fill');
  if (bar) bar.style.transform = `scaleX(${Math.max(0, Math.min(1, fraction))})`;
}

async function loadModels() {
  const load = createAssetLoader({ onProgress: showProgress });
  // Not fetched any more, though still present in public/models if wanted
  // back: tree-a/tree-b (replaced by oak.glb) and motorcycle (replaced by
  // truck.glb) — 834KB of downloads retired.
  const [church, crow, cross, gravestoneA, gravestoneB, stones, oak, truck, watcher, boulder] =
    await Promise.all([
      load.required('/models/church.glb').catch((e) => {
        console.error('chapel failed to load', e);
        return null; // world.js builds a shell; loading screen still clears
      }),
      load.optional('/models/crow.glb'),
      load.optional('/models/cross.glb'),
      load.optional('/models/gravestone-a.glb'),
      load.optional('/models/gravestone-b.glb'),
      load.optional('/models/grave-stones.glb'),
      load.optional('/models/oak.glb'),
      load.optional('/models/truck.glb'),
      load.optional('/models/zombie.glb'),
      load.optional('/models/mossy-stone.glb'),
    ]);
  return { church, crow, cross, gravestoneA, gravestoneB, stones, oak, truck, watcher, boulder };
}


async function boot() {
  const state = createState();
  const tier = detectTier();
  const models = await loadModels();
  const app = initScene({
    canvas: document.getElementById('scene'),
    state, tier, models,
    onThunder: () => ambience.thunder(),
  });
  document.body.classList.add('ready');
  // Freeze the journey's basis before anything measures against it, so the
  // track height, the master timeline and the audio duck all span the same
  // number of pixels.
  viewportBasis(window.innerHeight);

  // The document's height and the timeline's span must agree, or the journey
  // either runs out early or never finishes. Both now come from the same
  // frozen pixel basis (see journey.js) rather than one being `vh` and the
  // other `innerHeight` -- units that are equal on desktop and differ by the
  // toolbar's height on iOS Safari.
  const track = document.getElementById('scroll-track');
  const sizeTrack = () => {
    track.style.height = `${journeyTrackPx(viewportBasis(window.innerHeight))}px`;
  };
  sizeTrack();

  const lenis = initScroll();
  buildTimeline(state);
  wireSkip(lenis, sizeTrack);

  // A rotation is a real layout change, unlike the toolbar wobble that
  // ignoreMobileResize (see timeline.js) deliberately swallows -- so it, and
  // only it, re-measures the basis and rebuilds the journey's geometry.
  window.addEventListener('orientationchange', () => {
    // The viewport reports its old size until after the rotation settles.
    setTimeout(() => {
      resetViewportBasis();
      viewportBasis(window.innerHeight);
      sizeTrack();
      ScrollTrigger.refresh();
    }, 250);
  });

  // Duck the swamp once the beats arrive, so the track is not competing with
  // crickets. Spanning the same fixed journey distance as the master
  // timeline, so `progress` here means the same thing it does there.
  ScrollTrigger.create({
    trigger: '#scroll-track',
    start: 'top top',
    end: () => `+=${journeyDistancePx(viewportBasis(window.innerHeight))}`,
    ignoreMobileResize: true,
    onUpdate: (self) => {
      ambience.setDuck(duckLevel(self.progress));
      // Once the altar is reached the skip control has nothing left to skip.
      document.body.classList.toggle('arrived', self.progress > 0.95);
    },
  });

  // Compositing a 3D scene into a tab nobody is looking at is pure battery
  // drain. Browsers throttle rAF in background tabs but do not reliably stop
  // it, and on a phone this is the difference between atmospheric and hostile.
  let visible = !document.hidden;
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
  gsap.ticker.add(() => { if (visible) app.render(); });
}

// The skip control is a real <a href="#chapel">, so it works with no JS and
// on the static paths. Here it is upgraded to a smooth Lenis jump, because
// a native anchor jump would teleport the scrubbed camera the entire length
// of the journey in one frame.
function wireSkip(lenis, sizeTrack) {
  const skip = document.getElementById('skip');
  if (!skip) return;
  skip.addEventListener('click', (e) => {
    e.preventDefault();
    // Deliberately NOT stopPropagation: this is a real gesture and letting it
    // reach the window unlocks the ambience, same as any other first tap.
    sizeTrack();
    // documentElement, not body: the track's height lives on a child of
    // <html>, and body.scrollHeight does not always reflect it.
    lenis.scrollTo(document.documentElement.scrollHeight, { duration: 2.2, lock: true });
  });
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
// simply be silent. So it starts itself at the first interaction that
// actually counts as one, rather than waiting to be found in the corner. The
// toggle remains for turning it back off.
//
// `touchstart` and `scroll` used to be on this list and are deliberately not
// any more: WebKit does not accept either as a user gesture, so on iOS the
// first scroll built a permanently-suspended AudioContext, burned the
// one-shot listener, and left the toggle claiming sound was on. `touchend` is
// the touch event WebKit does accept.
const UNLOCK_EVENTS = ['pointerdown', 'touchend', 'click', 'keydown', 'wheel'];
let soundArmed = true;
let soundStarting = false;

function onUnlock() { startAmbience(); }

function listenForUnlock(on) {
  for (const evt of UNLOCK_EVENTS) {
    if (on) window.addEventListener(evt, onUnlock, { passive: true });
    else window.removeEventListener(evt, onUnlock);
  }
}

async function startAmbience() {
  if (!soundArmed || soundStarting || ambience.running) return false;
  soundStarting = true;
  const running = await ambience.start();
  soundStarting = false;
  // A refused start leaves us armed and still listening. Unlike the previous
  // `{ once: true }` wiring, one attempt from a non-gesture cannot burn the
  // page's only chance to ever produce sound.
  if (!running) return false;
  markSound(true);
  listenForUnlock(false);
  return true;
}

listenForUnlock(true);

soundBtn?.addEventListener('click', async (e) => {
  e.stopPropagation();
  if (ambience.running) {
    ambience.stop();
    soundArmed = false; // an explicit "off" must not be undone by the next gesture
    listenForUnlock(false);
    markSound(false);
  } else {
    soundArmed = true;
    // A click is a gesture in every browser, so this path always succeeds
    // where the ambient unlock above may legitimately have been refused.
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
