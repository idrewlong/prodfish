import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createState } from './choreography.js';
import { detectTier } from './device.js';
import { initScene } from './scenes/sceneManager.js';
import { createAssetLoader } from './world/assets.js';
import { T_DOOR, T_GATE, T_FORK_SCROLL } from './world/path.js';
import { createRouteState } from './world/route.js';
import { CREDITS, BIO, CATALOG_URL } from './content/portfolio.js';
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

async function loadModels() {
  const load = createAssetLoader();
  const [church, crow, cross, gravestoneA, gravestoneB, treeA, treeB, stones] = await Promise.all([
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
  ]);
  return { church, crow, cross, gravestoneA, gravestoneB, treeA, treeB, stones };
}

// The signpost's arms are real buttons floated over the 3D post, so the
// choice is clickable, focusable and announced — not a mouse-only hotspot.
function attachSignpost(app, routeState) {
  const wrap = document.createElement('div');
  wrap.className = 'label label-sign';

  const beats = document.createElement('button');
  beats.type = 'button';
  beats.className = 'sign-arm';
  beats.textContent = 'the beats ↑';
  beats.addEventListener('click', () => routeState.choose('direct'));

  const work = document.createElement('button');
  work.type = 'button';
  work.className = 'sign-arm sign-arm-work';
  work.textContent = 'the work →';
  work.addEventListener('click', () => routeState.choose('work'));

  wrap.append(beats, work);
  app.labels.add({ anchor: app.anchors.sign, el: wrap });
}

// Credit labels are gated on the scenic route. The monument row stands off to
// the side of the direct path and is well within label range from it, so
// without this gate every walker would see credits floating over the
// graveyard whether or not they chose to visit them.
function attachCreditLabels(app, state) {
  const onWorkRoute = () => state.route === 'work';

  app.anchors.credits.forEach((anchor, i) => {
    const credit = CREDITS[i];
    if (!credit) return;
    const a = document.createElement('a');
    a.className = 'label';
    a.href = credit.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.innerHTML = `${credit.artist}<span class="label-track"></span>`;
    a.querySelector('.label-track').textContent = credit.track;
    app.labels.add({ anchor, el: a, when: onWorkRoute });
  });

  const crypt = document.createElement('div');
  crypt.className = 'label label-crypt';
  const bio = document.createElement('p');
  bio.textContent = BIO;
  const catalog = document.createElement('a');
  catalog.href = CATALOG_URL;
  catalog.target = '_blank';
  catalog.rel = 'noopener';
  catalog.textContent = 'the full catalog ↗';
  crypt.append(bio, catalog);
  app.labels.add({ anchor: app.anchors.crypt, el: crypt, when: onWorkRoute });
}

async function boot() {
  const state = createState();
  const tier = detectTier();
  const models = await loadModels();
  const app = initScene({ canvas: document.getElementById('scene'), state, tier, models });
  document.body.classList.add('ready');

  initScroll();
  let timeline = buildTimeline(state, state.route);

  // Switching routes rebuilds the timeline, because the door and altar sit at
  // different fractions of a longer curve. The scenic route also needs more
  // scroll to keep the metres-per-scroll pacing steady, so the track grows.
  // Both routes put the fork at T_FORK_SCROLL, so restoring the scroll
  // position by fraction leaves the camera exactly where it was: at the
  // signpost. Without that pinning the camera would jump on every switch.
  const routeState = createRouteState((next) => {
    state.route = next;
    document.getElementById('scroll-track').style.height = next === 'work' ? '1600vh' : '1000vh';
    timeline.scrollTrigger?.kill();
    timeline.kill();
    // Move the scroll position to the fork BEFORE building the new timeline.
    // buildTimeline() constructs a ScrollTrigger that syncs itself to the
    // CURRENT window.scrollY at construction time -- if that read happens
    // while scrollY is still the pre-switch value (now the wrong fraction of
    // the just-resized track), the fresh scrub timeline snaps to whatever
    // that stale fraction maps to (verified: it lands back near the arrival
    // act, pathT ~0.08) and only crawls back to the fork over the next
    // second of scrub interpolation -- a visible rewind-then-refly, exactly
    // the jump this pinning scheme exists to prevent. Reading `max` off
    // scrollHeight after the height change (already true here) and
    // scrolling first means the new ScrollTrigger's construction-time sync
    // reads the correct fraction from the start.
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, T_FORK_SCROLL * max);
    timeline = buildTimeline(state, next);
    ScrollTrigger.refresh();
  });

  attachSignpost(app, routeState);
  attachCreditLabels(app, state);

  ScrollTrigger.create({
    trigger: '#scroll-track',
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => routeState.syncLock(self.progress),
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
