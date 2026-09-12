import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createState } from './choreography.js';
import { detectTier } from './device.js';
import { initScene } from './scenes/sceneManager.js';
import { createAssetLoader, monotonic } from './world/assets.js';
import { T_DOOR, T_GATE } from './world/path.js';
import { CREDITS, BIO, GENIUS_URL, SOCIALS, creditLink } from './content/portfolio.js';
import { initScroll } from './scroll.js';
import { buildTimeline } from './timeline.js';
import { createPanels } from './panels.js';
import { createAmbience, duckLevel } from './audio.js';
import { journeyDistancePx, trackPxWithChapel, viewportBasis, resetViewportBasis } from './journey.js';

// Probing costs a real GL context, and contexts are a scarce per-tab resource
// -- browsers cap them at a handful and evict the oldest, which on a phone is
// the one the scene is drawing into. So the probe hands its context straight
// back via WEBGL_lose_context, and the answer is computed once and cached
// rather than re-derived at each branch below.
function probeWebgl() {
  try {
    const c = document.createElement('canvas');
    if (!window.WebGLRenderingContext) return false;
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

const hasWebgl = probeWebgl();

const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// --load is the one number the reveal reads from: how far the title has filled
// in, from nothing to the whole word. Kept separate from the loader so the
// reduced-motion and debug paths get the same feedback for free.
let bytesFraction = 0;
const showProgress = monotonic((fraction) => { bytesFraction = fraction; });

function setLoad(value) {
  document.body.style.setProperty('--load', String(value));
}

// The fill rises at whichever is slower, the bytes or the clock, and eases
// toward that target rather than snapping to it. A cached visit is paced by
// the clock and glides the whole way up; a slow connection is paced by the
// bytes and stays honest about how much is really here.
let shown = 0;
let revealDone = false;
function paceReveal() {
  // A frame already queued when the reveal finishes would otherwise land after
  // the fill is set full and paint the word half-empty, permanently.
  if (revealDone) return;
  // Nothing is on screen until the face lands; hold at zero rather than
  // burning the reveal behind a hidden title.
  if (!revealStart) return void requestAnimationFrame(paceReveal);
  const byClock = (performance.now() - revealStart) / REVEAL_FLOOR_MS;
  shown += (Math.min(bytesFraction, byClock) - shown) * 0.08;
  setLoad(shown);
  requestAnimationFrame(paceReveal);
}

// The blackletter face arrives from Google Fonts, and the title is held hidden
// until it lands -- otherwise the word paints in fallback serif and jumps a
// moment later. The cap means a font that never arrives costs a beat, not the
// whole loading screen.
//
// The reveal's clock starts here rather than at first script, so the fill
// always rises from nothing where it can be seen. Starting it earlier meant
// the download could finish behind a hidden title, which then appeared
// most-of-the-way full.
function awaitTitleFont() {
  const reveal = () => {
    if (revealStart) return;
    revealStart = performance.now();
    document.documentElement.classList.add('fonts-ready');
  };
  if (!document.fonts?.load) return reveal();
  const cap = setTimeout(reveal, 800);
  const done = () => { clearTimeout(cap); reveal(); };
  document.fonts.load('1em UnifrakturMaguntia', 'fish').then(done, done);
}

// A cached visit finishes the downloads in a few hundred milliseconds, which
// left the reveal as a flicker nobody could read -- the site appeared to start
// mid-thought. The fill is given a floor to climb through, measured from the
// moment the title becomes visible rather than from the last byte, so a slow
// load never pays it. Slow connections are unaffected: they are already past.
const REVEAL_FLOOR_MS = 2800;
// Set when the blackletter face is ready and the reveal becomes watchable.
let revealStart = 0;
// How long the fill takes to close the last of its distance once the scene is
// ready. Scene init blocks the main thread, which freezes the paced fill part
// way up; animating the remainder means the word always finishes visibly
// rather than jumping to full.
const SETTLE_MS = 600;

// The BeatStars player is effectively a second page load -- its own script
// bundle, fonts and artwork -- and it lives sixteen screens down the journey.
// Left `loading="lazy"` it did not begin until the visitor was nearly on top of
// it, so the altar framed an empty box for a beat after the camera settled.
// Dropping the lazy attribute outright was worse: that download then fought the
// 4.2MB chapel model for bandwidth during the one stretch that is on the clock.
//
// So it is neither. The frame stays lazy through the load and is promoted to
// eager once the loading screen has finished handing off -- by which point
// loadModels() has long resolved, so there is no download left to steal from,
// and the reveal's crossfade is over, so a third-party page laying itself out
// cannot hitch it. That still leaves the visitor's entire walk up the path for
// the player to arrive in.
//
// Flipping the attribute is the spec'd way to resume a deferred lazy load (the
// element's lazy load resumption steps run on the change), so a browser that
// does not honour it simply keeps today's behaviour rather than breaking. The
// markup keeps its real `src`, so the no-JS page is untouched.
//
// Deliberately NOT requestIdleCallback: gsap.ticker renders the scene every
// frame for as long as the tab is visible, so this page never reports idle
// time. Measured over CDP, the callback only ever ran via its own timeout --
// an arbitrary delay wearing the costume of a scheduling decision.
function warmEmbed() {
  const frame = document.querySelector('.altar-frame iframe[loading="lazy"]');
  if (frame) frame.loading = 'eager';
  // Promoting the frame is the moment the player actually starts loading, so
  // it is also the moment the stall clock may start. See watchPlayer.
  startPlayerStallClock();
}

// The altar used to frame 560px of flat black for as long as the third-party
// player took to arrive, which on a slow connection — or behind a blocker, or
// with a bad store id — is indistinguishable from a site that is simply
// broken. This says which it is.
//
// .player-pending is added from JS rather than sitting in the markup so the
// no-JS page keeps an ordinary, opaque, working iframe: the class is what
// makes the frame transparent and shows the message behind it.
//
// What is and is not detectable here, since it constrains the design:
// a cross-origin iframe exposes nothing about what it loaded. contentDocument
// is null and contentWindow.location throws whether the embed rendered
// perfectly or failed outright, and `load` fires for a browser error page
// just as it does for a real one. Measured both ways — the two are
// indistinguishable from script.
//
// So this does NOT try to tell success from failure. It covers the case that
// is both detectable and by far the most common: the player is simply slow,
// and the altar framed an unexplained black rectangle for the whole wait.
// While no load has fired the frame says so; once one does, it hands over and
// whatever BeatStars renders — player or its own empty state — is theirs.
//
// STALL_MS escalates the wording for an embed that never arrives at all. A
// blocked embed that still fires `load` will fall through to BeatStars' own
// blank frame, which is the one case nothing here can improve on.
//
// The clock is started by warmEmbed(), NOT here. watchPlayer runs at parse,
// but the frame is loading="lazy" and does not fetch anything until warmEmbed
// promotes it at markReady() — so a timer started here would be measuring
// scene load and the walk down the road, not the player. It ran out before
// the altar was ever on screen, and "taking its time" was the only wording
// anyone saw. Covered by tests/e2e/smoke.spec.js.
const PLAYER_STALL_MS = 8000;

let startPlayerStallClock = () => {};

function watchPlayer() {
  const frame = document.querySelector('.altar-frame iframe');
  const shell = frame?.closest('.altar-frame');
  if (!frame || !shell) return;
  shell.classList.add('player-pending');
  let stalled = 0;
  startPlayerStallClock = () => {
    // warmEmbed is reachable from more than one boot path; only the first
    // call is the moment the fetch began.
    if (stalled) return;
    stalled = setTimeout(() => shell.classList.add('player-stalled'), PLAYER_STALL_MS);
  };
  // No need to guard against the load having already fired: the frame is
  // loading="lazy" and stays deferred until warmEmbed() promotes it, which
  // happens long after this runs.
  frame.addEventListener('load', () => {
    clearTimeout(stalled);
    startPlayerStallClock = () => {};
    shell.classList.remove('player-pending', 'player-stalled');
  }, { once: true });
}

// Full title, then the handoff: the black ground fades off a word that is
// already exactly where the fill was, because it is the same word.
function markReady() {
  showProgress(1);
  const wait = Math.max(0, REVEAL_FLOOR_MS - (performance.now() - (revealStart || performance.now())));
  setTimeout(() => {
    revealDone = true;
    // Hand the last stretch to CSS: the eased fill is asymptotic, and a stall
    // during scene init can leave it well short. .settling gives --load a
    // transition so it closes the gap smoothly however far it has to go.
    document.body.classList.add('settling');
    setLoad(1);
    setTimeout(() => {
      document.body.classList.add('ready');
      // The filled copy crossfades into the title over the same 0.9s the
      // overlay takes to clear; only then does loading let go of the hero --
      // and only then is it safe to let the third-party player start. Every
      // scene path (full, reduced, debug) arrives here.
      setTimeout(() => {
        document.body.classList.remove('loading', 'settling');
        warmEmbed();
      }, 900);
    }, SETTLE_MS);
  }, wait);
}

// Read back rather than recomputed: the inline script in index.html already
// chose between the full chapel and its mobile cut, and issued the preload
// hint for that exact URL. Deciding again here would risk fetching the file
// the hint did not warm — a cache miss on the one download the whole loading
// screen is waiting for. The fallback covers the no-JS-in-head case that
// cannot actually happen (this file is a module in the same document) and
// the unit tests, which import main.js without a document.
const CHURCH_URL = globalThis.__CHURCH__ ?? '/models/church.glb';

async function loadModels() {
  const load = createAssetLoader({ onProgress: showProgress });
  // Not fetched any more, though still present in public/models if wanted
  // back: tree-a/tree-b (replaced by oak.glb), motorcycle, and truck (both
  // dropped from the scene) — around 990KB of downloads retired.
  const [church, crow, cross, gravestoneA, gravestoneB, stones, oak, watcher, boulder] =
    await Promise.all([
      load.required(CHURCH_URL).catch((e) => {
        console.error('chapel failed to load', e);
        return null; // world.js builds a shell; loading screen still clears
      }),
      load.optional('/models/crow.glb'),
      load.optional('/models/cross.glb'),
      load.optional('/models/gravestone-a.glb'),
      load.optional('/models/gravestone-b.glb'),
      load.optional('/models/grave-stones.glb'),
      load.optional('/models/oak.glb'),
      load.optional('/models/zombie.glb'),
      load.optional('/models/mossy-stone.glb'),
    ]);
  return { church, crow, cross, gravestoneA, gravestoneB, stones, oak, watcher, boulder };
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
  markReady();
  // Freeze the journey's basis before anything measures against it, so the
  // track height, the master timeline and the audio duck all span the same
  // number of pixels.
  viewportBasis(window.innerHeight);

  // The document's height and the timeline's span must agree, or the journey
  // either runs out early or never finishes. Both now come from the same
  // frozen pixel basis (see journey.js) rather than one being `vh` and the
  // other `innerHeight` -- units that are equal on desktop and differ by the
  // toolbar's height on iOS Safari.
  // The chapel is pinned to the bottom of the track and grows upward, so a
  // chapel taller than one viewport would start framing itself mid-journey.
  // Measuring it here and handing it to trackPxWithChapel keeps its top edge
  // where the timeline ends, whatever the chapel comes to hold.
  const track = document.getElementById('scroll-track');
  const chapel = document.getElementById('chapel');
  const sizeTrack = () => {
    const basis = viewportBasis(window.innerHeight);
    track.style.height = `${trackPxWithChapel(basis, chapel?.offsetHeight ?? 0)}px`;
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

  // A WIDTH change is the other real layout change, and it was going
  // unnoticed. The chapel is `position: absolute; bottom: 0` and its height
  // follows from its content reflowing at the new width -- a narrower window
  // wraps the bio and the credit rows onto more lines and makes it taller.
  // The track absorbs that overflow (see trackPxWithChapel), so if the track
  // is not re-sized the chapel's top edge no longer lands where the timeline
  // ends and it starts framing itself mid-walk.
  //
  // Width ONLY, and deliberately: iOS Safari fires `resize` on every toolbar
  // collapse, which changes the height and nothing else. Re-measuring on that
  // is the lurch that the frozen viewport basis (see journey.js) exists to
  // prevent, so the basis is never reset here -- the journey keeps spanning
  // exactly the pixels it started with, and only the chapel's overflow is
  // recomputed. Debounced because a resize drag fires continuously and both
  // sizeTrack() and refresh() read layout.
  let lastWidth = window.innerWidth;
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      sizeTrack();
      ScrollTrigger.refresh();
    }, 150);
  }, { passive: true });

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
  markReady();
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
  markReady();
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
  // Written into the caption rather than over the whole overlay: textContent
  // on #loading would delete the mark the message is meant to sit under.
  // .failed drains the light out of it instead — a dead candle.
  document.body.classList.add('failed');
  const word = loading.querySelector('.load-word') ?? loading;
  // #loading is aria-hidden while it is doing its job: it is decoration over a
  // heading that is already announced. A failure is the one thing in it that
  // is not decoration, so the overlay comes back out of hiding and the caption
  // becomes a live region. Without this the only signal that the site is dead
  // was a visual one, and a screen reader sat on a silent page forever.
  loading.removeAttribute('aria-hidden');
  word.setAttribute('role', 'alert');
  // A live region that gains its role and its text in the same task is
  // routinely missed; letting the role land first is what gets it spoken.
  requestAnimationFrame(() => {
    word.textContent = 'something went wrong — refresh to retry';
  });
  // Inline styles win over the .reduced/.no-webgl CSS rules that otherwise
  // hide #loading in those modes, so the message is visible regardless of
  // which boot path failed.
  loading.style.display = 'flex';
  loading.style.opacity = '1';
}

// The Spotify mark, inline so it costs no request and inherits currentColor.
// Drawn in the page's bone rather than Spotify green on purpose: their brand
// guidelines allow the mark in monochrome black or white, and a green blob is
// the one thing on this page that would not belong to it. The path is the
// official mark, unmodified in shape.
function spotifyMark() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'work-spotify');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', 'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.52 '
    + '17.28c-.24.36-.66.48-1.02.24-2.82-1.74-6.36-2.1-10.56-1.14-.42.12-.78-.18-.9-.54-.12-.42.18-.78.54-.9 '
    + '4.56-1.02 8.52-.6 11.64 1.32.42.18.48.66.3 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.02.6-1.14 '
    + '4.32-1.32 9.72-.66 13.44 1.62.361.181.54.78.301 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 '
    + '4.26-1.26 11.28-1.02 15.72 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.299z');
  svg.append(path);
  return svg;
}

// One credit row of the ledger: artist on the left, track on the right.
//
// The row is a link ONLY when creditLink() hands back a real Spotify URL.
// While the catalog is still placeholder that means most rows are inert text,
// which is the point — a row styled as clickable that goes nowhere is a worse
// experience than one that plainly is not a link yet. Both shapes render the
// same two columns, so the ledger does not go ragged as URLs are filled in.
function creditRow(credit) {
  const li = document.createElement('li');
  const href = creditLink(credit);

  const artist = document.createElement('span');
  artist.className = 'work-artist';
  artist.textContent = credit.artist;

  const track = document.createElement('span');
  track.className = 'work-track';
  track.textContent = credit.track;

  if (!href) {
    li.className = 'work-row work-row-plain';
    li.append(artist, track);
    return li;
  }

  li.className = 'work-row';
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  // The visible text is "artist" + "track", which read on their own tell a
  // screen reader nothing about where the link goes or that it leaves the
  // page. This says both, once, without adding visible chrome.
  a.setAttribute('aria-label', `${credit.track} by ${credit.artist} — listen on Spotify (opens in a new tab)`);
  track.append(spotifyMark());
  a.append(artist, track);
  li.append(a);
  return li;
}

// Fills the credits and about panels from the content module. This is the
// only place a credit's text is ever rendered — the carved stones along the
// approach are untitled geometry and read nothing from CREDITS, so editing a
// track or artist here touches the DOM and nothing else.
function fillStaticPortfolio() {
  const list = document.querySelector('.work-list');
  const bio = document.querySelector('.work-bio');
  const socialNav = document.querySelector('.work-socials');
  const catalog = document.querySelector('.work-catalog');
  if (!list || !bio || !socialNav || !catalog) return;
  for (const c of CREDITS) list.append(creditRow(c));
  bio.textContent = BIO;
  for (const s of SOCIALS) {
    const a = document.createElement('a');
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = s.label;
    socialNav.append(a);
  }
  catalog.href = GENIUS_URL;
}

fillStaticPortfolio();
watchPlayer();

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

// The same guard the volume row needs, and for a sharper reason. The unlock
// listeners below sit on `window` and fire on pointerdown; a click on this
// button is a pointerdown too, so the ambience would start on the way down
// and the click handler — arriving a millisecond later to a context that is
// now running — would read it as "already on" and immediately stop it again.
// Net effect: the first press appeared to do nothing at all, the volume row
// never came up (it hangs off body.sound-on), and only a second press
// worked. Stopping the pointerdown here leaves the click handler as the one
// authority on what this button means. Covered by tests/e2e/smoke.spec.js.
soundBtn?.addEventListener('pointerdown', (e) => e.stopPropagation());

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

awaitTitleFont();

// body.loading is what hands the hero title over to the loading sequence, so
// it is set only on the paths that actually boot a scene. The no-WebGL page
// never does, and gets an ordinary lit title with no ember over it.
if (hasWebgl) {
  document.body.classList.add('loading');
  paceReveal();
}

if (!hasWebgl) {
  document.body.classList.add('no-webgl');
  // This path never boots a scene, so it never reaches markReady(). #chapel is
  // laid out visibly here (see .no-webgl #chapel), which usually means the lazy
  // frame loads on its own -- but that depends on where the section lands, and
  // there is no model download left to protect either way.
  warmEmbed();
} else if (new URLSearchParams(location.search).has('debug')) {
  bootDebug().catch(bootFailed);
} else if (prefersReduced) {
  bootStatic().catch(bootFailed);
} else {
  boot().catch(bootFailed);
}
