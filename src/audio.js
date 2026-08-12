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

  function noiseBuffer(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // Brown-ish noise: integrated white, which sits low and moves like air
      // rather than hissing like static.
      last = (last + Math.random() * 2 - 1) * 0.5;
      d[i] = last;
    }
    return buf;
  }

  function wind() {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(6);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = ctx.createGain();
    gain.gain.value = 0.14;
    // Slow swell, so the air is never at one level.
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.06;
    lfoGain.gain.value = 0.06;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();
    src.connect(filter).connect(gain).connect(master);
    src.start();
  }

  function chirp(when) {
    // A cricket: a short band-passed noise burst, pitched high.
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.06);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3600 + Math.random() * 1800;
    bp.Q.value = 18;
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

    // A dry hinge. Resonant band-passed noise whose pitch falls as the door
    // swings, plus a wooden knock as it comes to rest.
    creak() {
      if (!started) return;
      const now = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(1.6);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 22;
      bp.frequency.setValueAtTime(880, now);
      bp.frequency.exponentialRampToValueAtTime(300, now + 1.25);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.24, now + 0.18);
      g.gain.exponentialRampToValueAtTime(0.06, now + 0.9);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
      src.connect(bp).connect(g).connect(master);
      src.start(now);
      src.stop(now + 1.6);

      const knock = ctx.createOscillator();
      knock.type = 'triangle';
      knock.frequency.setValueAtTime(120, now + 1.25);
      knock.frequency.exponentialRampToValueAtTime(58, now + 1.42);
      const kg = ctx.createGain();
      kg.gain.setValueAtTime(0.0001, now + 1.25);
      kg.gain.exponentialRampToValueAtTime(0.16, now + 1.28);
      kg.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
      knock.connect(kg).connect(master);
      knock.start(now + 1.25);
      knock.stop(now + 1.55);
    },

    // Thunder is called by the weather, so the rumble follows its own flash.
    thunder() {
      if (!started) return;
      const now = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(3.5);
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
