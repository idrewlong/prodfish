// Swamp ambience, synthesised in the browser rather than streamed from a
// file. A field recording would sound better, but it would also be a
// multi-megabyte download on a site whose whole point is atmosphere arriving
// fast, and any loop short enough to ship audibly repeats. This is a few
// hundred bytes of code, never repeats, and starts instantly.
//
// Browsers refuse to start audio without a user gesture, so nothing here
// runs until the visitor asks for it. There is a control in the corner and
// it starts silent.

// How loud the ambience should be for a given scroll position. It ducks
// hard once the visitor reaches the beats: they came to listen to music, and
// crickets over a track is the fastest way to make someone reach for mute.
export function duckLevel(scrollProgress, beatsStart = 0.82) {
  if (scrollProgress < beatsStart) return 1;
  const into = Math.min((scrollProgress - beatsStart) / 0.1, 1);
  return 1 - 0.85 * into;
}

// The final gain is the visitor's setting multiplied by the scroll duck, so
// the two never fight: turning it up during the beats still respects the
// duck, and scrolling back out restores whatever level they chose.
export function mixGain(userVolume, duck, ceiling = 0.9) {
  return Math.max(0, Math.min(1, userVolume)) * Math.max(0, Math.min(1, duck)) * ceiling;
}

// How many footfalls a given distance covers. A stride is ~0.75m, and the
// camera is a person walking, so steps follow DISTANCE TRAVELLED rather
// than time -- stop scrolling and the walking stops, which is the whole
// point.
export const STRIDE_M = 0.78;

export function stepsFor(distanceM) {
  return Math.max(0, Math.floor(distanceM / STRIDE_M));
}

export function crickChance(elapsed, rate) {
  // Chirps come in bursts, not on a metronome: a slow envelope gates a
  // faster trigger, so the field goes quiet and picks up again.
  const swell = 0.55 + 0.45 * Math.sin(elapsed * 0.09);
  return rate * swell;
}

export function createAmbience() {
  let ctx = null;
  let master = null;
  let timer = null;
  let started = false;
  let userVolume = 0.7;
  let duck = 1;

  // Two noise colours, and which one is used matters more than it looks.
  // Brown noise (integrated white) sits low and moves like air, which is
  // right for wind and thunder. But it has almost no energy up where
  // crickets and a dry hinge live, so pushing it through a narrow bandpass
  // at 880Hz or 3.6kHz produced near-silence -- the reason the door creak
  // and the crickets could not be heard at all.
  function noiseBuffer(seconds, colour = 'white') {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    if (colour === 'brown') {
      let last = 0;
      for (let i = 0; i < len; i++) {
        last = (last + (Math.random() * 2 - 1) * 0.08) * 0.995;
        d[i] = Math.max(-1, Math.min(1, last * 3.2));
      }
    } else {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  function wind() {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(6, 'brown');
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = ctx.createGain();
    // Wind is a bed, not an event. At 0.14 it sat on top of the crickets,
    // the creak and the candles instead of underneath them.
    gain.gain.value = 0.045;
    // Slow swell, so the air is never at one level.
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.06;
    lfoGain.gain.value = 0.022;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();
    src.connect(filter).connect(gain).connect(master);
    src.start();
  }

  function chirp(when) {
    // A cricket: a short band-passed noise burst, pitched high.
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.06, 'white');
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3600 + Math.random() * 1800;
    bp.Q.value = 9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.05 + Math.random() * 0.05, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    src.connect(bp).connect(g).connect(master);
    src.start(when);
    src.stop(when + 0.08);
  }

  function frog(when) {
    // A bullfrog: a low, short, slightly detuned croak.
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(96 + Math.random() * 30, when);
    osc.frequency.exponentialRampToValueAtTime(62, when + 0.22);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.08, when + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.3);
    osc.connect(lp).connect(g).connect(master);
    osc.start(when);
    osc.stop(when + 0.35);
  }

  function tick() {
    const now = ctx.currentTime;
    const elapsed = now;
    // Crickets, in bursts.
    const rate = crickChance(elapsed, 9);
    for (let i = 0; i < 8; i++) {
      if (Math.random() < rate / 20) chirp(now + Math.random() * 0.5);
    }
    if (Math.random() < 0.06) frog(now + Math.random() * 0.8);
  }

  return {
    get running() { return started; },

    async start() {
      if (started) return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ctx = new Ctx();
      await ctx.resume();
      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
      wind();
      timer = setInterval(tick, 500);
      // Fade up, so it arrives rather than switches on.
      master.gain.linearRampToValueAtTime(mixGain(userVolume, duck), ctx.currentTime + 2.5);
      started = true;
    },

    stop() {
      if (!started) return;
      clearInterval(timer);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      const dying = ctx;
      setTimeout(() => dying.close(), 600);
      started = false;
    },

    get volume() { return userVolume; },

    // The visitor's own level, 0..1. Kept even while stopped, so turning
    // sound back on restores what they chose rather than resetting.
    setVolume(v) {
      userVolume = Math.max(0, Math.min(1, v));
      if (started) master.gain.linearRampToValueAtTime(mixGain(userVolume, duck), ctx.currentTime + 0.12);
    },

    // Ducked by the scroll position: see duckLevel above.
    setDuck(level) {
      duck = level;
      if (!started) return;
      master.gain.linearRampToValueAtTime(mixGain(userVolume, duck), ctx.currentTime + 0.5);
    },

    // A dry hinge. Real creak is stick-slip: the door binds, releases, and
    // rings the timber -- a burst of short pitched squeaks at irregular
    // intervals, not one smooth sweep. The previous version swept a filter
    // across white noise, which is the textbook recipe for a WHOOSH and
    // sounded like one. These are tuned oscillators through a resonant
    // filter instead, so they read as timber under strain.
    creak() {
      if (!started) return;
      const now = ctx.currentTime;

      // The squeaks, slowing and dropping in pitch as the door swings wide.
      let at = now + 0.05;
      const count = 7 + Math.floor(Math.random() * 4);
      for (let i = 0; i < count; i++) {
        const u = i / count;
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        const base = 520 - u * 260 + (Math.random() - 0.5) * 70;
        osc.frequency.setValueAtTime(base, at);
        // Each squeak bends upward as the timber binds, then releases.
        osc.frequency.linearRampToValueAtTime(base * 1.35, at + 0.05);
        osc.frequency.linearRampToValueAtTime(base * 0.9, at + 0.11);

        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = base * 2.1;
        bp.Q.value = 7;

        const g = ctx.createGain();
        const peak = 0.05 + Math.random() * 0.05;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(peak, at + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.13);

        osc.connect(bp).connect(g).connect(master);
        osc.start(at);
        osc.stop(at + 0.16);
        // Irregular gaps, widening as it opens.
        at += 0.07 + u * 0.11 + Math.random() * 0.05;
      }

      // The body of the door groaning under its own weight, underneath.
      const groan = ctx.createOscillator();
      groan.type = 'triangle';
      groan.frequency.setValueAtTime(78, now);
      groan.frequency.linearRampToValueAtTime(54, now + 1.1);
      const gg = ctx.createGain();
      gg.gain.setValueAtTime(0.0001, now);
      gg.gain.exponentialRampToValueAtTime(0.07, now + 0.25);
      gg.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
      groan.connect(gg).connect(master);
      groan.start(now);
      groan.stop(now + 1.4);

      // And the latch knocking as it comes to rest.
      const knock = ctx.createOscillator();
      knock.type = 'triangle';
      const kAt = at + 0.1;
      knock.frequency.setValueAtTime(130, kAt);
      knock.frequency.exponentialRampToValueAtTime(62, kAt + 0.16);
      const kg = ctx.createGain();
      kg.gain.setValueAtTime(0.0001, kAt);
      kg.gain.exponentialRampToValueAtTime(0.14, kAt + 0.02);
      kg.gain.exponentialRampToValueAtTime(0.0001, kAt + 0.24);
      knock.connect(kg).connect(master);
      knock.start(kAt);
      knock.stop(kAt + 0.3);
    },

    // A footfall on wet dirt: a short scuff of filtered noise with a soft
    // body under it. Alternates weight slightly so a walk never sounds like
    // the same sample on repeat.
    step(index) {
      if (!started) return;
      const now = ctx.currentTime;
      const heavy = index % 2 === 0;

      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(0.22, 'white');
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(heavy ? 900 : 1150, now);
      bp.frequency.exponentialRampToValueAtTime(380, now + 0.14);
      bp.Q.value = 1.1;
      const g = ctx.createGain();
      const peak = (heavy ? 0.07 : 0.055) * (0.85 + Math.random() * 0.3);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(peak, now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
      src.connect(bp).connect(g).connect(master);
      src.start(now);
      src.stop(now + 0.24);

      const body = ctx.createOscillator();
      body.type = 'sine';
      body.frequency.setValueAtTime(heavy ? 96 : 116, now);
      body.frequency.exponentialRampToValueAtTime(52, now + 0.1);
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.0001, now);
      bg.gain.exponentialRampToValueAtTime(0.045, now + 0.012);
      bg.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      body.connect(bg).connect(master);
      body.start(now);
      body.stop(now + 0.18);
    },

    // Thunder is called by the weather, so the rumble follows its own flash.
    thunder() {
      if (!started) return;
      const now = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(3.5, 'brown');
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(220, now);
      lp.frequency.exponentialRampToValueAtTime(70, now + 3);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.5, now + 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 3.4);
      src.connect(lp).connect(g).connect(master);
      src.start(now);
      src.stop(now + 3.5);
    },
  };
}
