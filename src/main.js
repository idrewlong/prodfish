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
import { trackHeightVh, journeyDistancePx } from './journey.js';
import { createPicker, pointerToNdc } from './picking.js';
import { ENGRAVED_INK, ENGRAVED_LIT } from './world/engraving.js';

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

// The sign itself is the control: clicking the carved board picks that road.
// Hover lights the letters by changing one material colour -- the canvas
// texture carries only the letterform alpha, so nothing is redrawn.
//
// `pick` (not routeState.choose directly) handles the choice: see boot()'s
// pickRoute for why -- routeState.choose() is deliberately a no-op when the
// requested route is already current (route.js's own test suite locks that
// in), which left the DEFAULT route unreachable through the sign with
// nothing else to fall back on now that the old always-present DOM buttons
// are gone.
function attachSignInteraction(app, routeState, canvas, pick) {
  const picker = createPicker({ camera: app.camera });
  // The picker resolves both the signpost's arms and the song stones: one
  // interaction vocabulary in the world rather than two.
  picker.setTargets([...app.signArms, ...app.creditStones, ...app.chapelLinks]);

  let hovered = null;
  const setHover = (arm) => {
    if (hovered === arm) return;
    if (hovered) hovered.userData.textMesh.material.color.setHex(ENGRAVED_INK);
    hovered = arm;
    if (hovered) hovered.userData.textMesh.material.color.setHex(ENGRAVED_LIT);
    canvas.style.cursor = hovered ? 'pointer' : '';
  };

  const ndcFor = (e) => pointerToNdc(e.clientX, e.clientY, canvas.getBoundingClientRect());

  // Hover is resolved at most once per frame: pointermove fires far faster
  // than the scene renders, and a raycast per event is wasted work.
  let queued = null;
  canvas.addEventListener('pointermove', (e) => {
    queued = ndcFor(e);
  });
  gsap.ticker.add(() => {
    if (!queued) return;
    setHover(picker.pick(queued));
    queued = null;
  });

  canvas.addEventListener('click', (e) => {
    const hit = picker.pick(ndcFor(e));
    if (!hit) return;
    // A stone opens its track. Stones stay clickable after the fork locks --
    // the lock only governs which road you are on, not whether you can read
    // the markers along it.
    if (hit.userData.href) {
      window.open(hit.userData.href, '_blank', 'noopener');
      return;
    }
    if (routeState.isLocked()) return;
    if (hit.userData.route) pick(hit.userData.route);
  });

  // Keyboard and screen-reader path: the same two choices as real controls.
  for (const btn of document.querySelectorAll('#sign-controls button')) {
    const arm = app.signArms.find((a) => a.userData.route === btn.dataset.route);
    btn.addEventListener('focus', () => setHover(arm ?? null));
    btn.addEventListener('blur', () => setHover(null));
    btn.addEventListener('click', () => pick(btn.dataset.route));
  }
}

// A parked page can read as a broken one. If the visitor reaches the sign and
// sits there without choosing, say so quietly.
function attachChooseHint(routeState) {
  const hint = document.getElementById('choose-hint');
  if (!hint) return;
  let idleSince = null;
  gsap.ticker.add(() => {
    const atFork = !routeState.isLocked()
      && window.scrollY >= (document.documentElement.scrollHeight - window.innerHeight) - 4;
    if (!atFork) { idleSince = null; hint.classList.remove('show'); return; }
    if (idleSince === null) idleSince = performance.now();
    if (performance.now() - idleSince > 2500) hint.classList.add('show');
  });
}

// Credit labels are gated on the scenic route. The monument row stands off to
// the side of the direct path and is well within label range from it, so
// without this gate every walker would see credits floating over the
// graveyard whether or not they chose to visit them.
function attachCreditLabels(app, state) {
  const onWorkRoute = () => state.route === 'work';

  // The credits themselves are no longer floating labels: they are carved
  // into the faces of the stones (see world/monuments.js) and the stones are
  // clickable. Along a row of ten they used to pile up on top of one another
  // and read as web furniture stuck over the world. They remain in the DOM
  // as real links in the static portfolio section, which is what keyboard
  // users, screen readers and crawlers get.

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

  // Park the journey: until a road is chosen the document ends at the
  // signpost. See src/journey.js for why this is a height change rather
  // than a scroll interception.
  const track = document.getElementById('scroll-track');
  track.style.height = `${trackHeightVh(null, false)}vh`;
  let timeline = buildTimeline(state, state.route);

  // Switching routes rebuilds the timeline, because the door and altar sit at
  // different fractions of a longer curve. The scenic route also needs more
  // scroll to keep the metres-per-scroll pacing steady, so the track grows.
  // Both routes put the fork at T_FORK_SCROLL, so restoring the scroll
  // position by fraction leaves the camera exactly where it was: at the
  // signpost. Without that pinning the camera would jump on every switch.
  let chosen = false;
  function activateRoute(next) {
    chosen = true;
    document.getElementById('choose-hint')?.classList.remove('show');
    state.route = next;
    track.style.height = `${trackHeightVh(next, true)}vh`;
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
  }
  const routeState = createRouteState(activateRoute);

  // routeState.choose() is deliberately a no-op when `next` is already the
  // current route (see route.js and its test "choosing the route already
  // active does nothing") -- switching AWAY from a route is the only thing
  // it models. `direct` is that current route from the moment the page
  // loads, so picking "the beats" arm on a first visit would otherwise hit
  // that no-op and leave the journey parked forever, with no other control
  // left to un-park it now that the old always-present DOM buttons are gone.
  // This is the one path where the sign needs to activate directly instead
  // of going through routeState.
  function pickRoute(next) {
    if (routeState.isLocked()) return;
    if (!chosen && next === routeState.get()) { activateRoute(next); return; }
    routeState.choose(next);
  }

  attachSignInteraction(app, routeState, document.getElementById('scene'), pickRoute);
  attachChooseHint(routeState);
  attachCreditLabels(app, state);

  ScrollTrigger.create({
    trigger: '#scroll-track',
    start: 'top top',
    // Must span the same fixed journey distance as the master timeline.
    // With `bottom bottom` this measured the parked document instead, so
    // `self.progress` ran 1/T_FORK_SCROLL too fast and locked the route
    // choice at ~9% of the journey -- killing the signpost before the
    // camera ever reached it.
    end: () => `+=${journeyDistancePx(state.route, window.innerHeight)}`,
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
