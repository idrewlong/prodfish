import * as THREE from 'three';
import { candleIntensity } from './events.js';

export const TOTAL = 14;

// Soft radial-gradient texture shared by every flame/halo sprite. Sprites
// always face the camera (unlike a static plane, which can foreshorten to a
// thin sliver or, worse, blow out into a hard-edged rectangle when the
// camera passes close by) and the gradient falloff keeps that close pass
// looking like a glow instead of a flat lit box.
function makeGlowTexture() {
  // A round glow, used for the soft halo pooled around each flame.
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,214,150,0.85)');
  g.addColorStop(0.45, 'rgba(255,150,54,0.28)');
  g.addColorStop(1, 'rgba(255,120,30,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// The flame itself. A radial blob reads as a glowing dot; a real flame is a
// teardrop with a white-hot base, a saturated orange body and a soft tip
// that fades out. Drawn as stacked ellipses rather than one gradient so the
// core stays tight while the tip stays wide and soft.
function makeFlameTexture() {
  const w = 96;
  const h = 160;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Outer body: broad, orange, fading at the tip.
  const body = ctx.createRadialGradient(w / 2, h * 0.68, 2, w / 2, h * 0.62, w * 0.52);
  body.addColorStop(0, 'rgba(255,170,60,0.95)');
  body.addColorStop(0.55, 'rgba(255,120,26,0.42)');
  body.addColorStop(1, 'rgba(255,90,15,0)');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.64, w * 0.30, h * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();

  // The taper up to the tip.
  const tip = ctx.createLinearGradient(0, h * 0.42, 0, 0);
  tip.addColorStop(0, 'rgba(255,150,45,0.45)');
  tip.addColorStop(1, 'rgba(255,110,20,0)');
  ctx.fillStyle = tip;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, 0);
  ctx.quadraticCurveTo(w * 0.86, h * 0.34, w * 0.5, h * 0.5);
  ctx.quadraticCurveTo(w * 0.14, h * 0.34, w * 0.5, 0);
  ctx.fill();

  // White-hot core just above the wick.
  const core = ctx.createRadialGradient(w / 2, h * 0.74, 0, w / 2, h * 0.74, w * 0.17);
  core.addColorStop(0, 'rgba(255,246,214,0.98)');
  core.addColorStop(0.6, 'rgba(255,206,120,0.5)');
  core.addColorStop(1, 'rgba(255,170,70,0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.74, w * 0.13, h * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  // A dim blue base, where the flame is hottest and least luminous.
  const base = ctx.createRadialGradient(w / 2, h * 0.85, 0, w / 2, h * 0.85, w * 0.12);
  base.addColorStop(0, 'rgba(120,170,255,0.30)');
  base.addColorStop(1, 'rgba(90,140,255,0)');
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.85, w * 0.10, h * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();

  return new THREE.CanvasTexture(canvas);
}

// Candle z placement: first candle just inside the door, spaced back toward
// the altar. Shared by the placement loop below and the light-pool tracking
// in update() -- kept as a named constant (not re-derived) so the two stay
// in sync by construction.
export const CANDLE_Z0 = -2.6;
export const CANDLE_Z_SPAN = 7.4;

// Candle rows flank the aisle (x = ±0.9) from just inside the door to the
// altar. Flames are camera-facing additive sprites; a small pool of real
// point lights follows the most recently lit candles so low tiers stay
// cheap.
export function createCandles({ scene, altarAnchor, crossGltf, maxLights, onCandleLit }) {
  const candles = [];
  const glowTex = makeGlowTexture();
  const flameTex = makeFlameTexture();
  const flameMat = new THREE.SpriteMaterial({
    map: flameTex,
    color: '#ff9a3d',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  for (let i = 0; i < TOTAL; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = CANDLE_Z0 - (i / TOTAL) * CANDLE_Z_SPAN;
    const g = new THREE.Group();
    const wax = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.045, 0.28, 8),
      new THREE.MeshStandardMaterial({ color: '#8f887a', roughness: 0.8 }),
    );
    wax.position.y = 0.14;
    // Flame + a larger, softer halo behind it so the candle reads as a
    // small glowing pool from aisle distance, not just a thin sliver.
    // fix-round: bumped again (0.22x0.3 -> 0.3x0.42, 0.75 -> 0.95) -- still
    // camera-facing sprites so they never foreshorten, just a bigger, more
    // insistent glow now that ignition timing (see update()) actually keeps
    // them in view as they light.
    const flame = new THREE.Sprite(flameMat.clone());
    flame.material.color.set('#ffffff'); // the texture already carries the colour
    flame.scale.set(0.17, 0.30, 1);
    flame.position.y = 0.36;
    const haloMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: '#ff9a3d',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const halo = new THREE.Sprite(haloMat);
    halo.scale.set(0.95, 0.95, 1);
    halo.position.y = 0.37;
    g.add(wax, flame, halo);
    g.position.set(side * 0.9, 0.55, z); // on low pew-end stands
    scene.add(g);
    candles.push({ flame, halo, z });
  }

  // Shared light pool.
  const lights = Array.from({ length: maxLights }, () => {
    const l = new THREE.PointLight('#ff7a26', 0, 4.5, 2);
    scene.add(l);
    return l;
  });

  // Neon cross: generated GLB if present, else two emissive bars. Materials
  // start black and are lerped toward full red by crossGlow every frame (see
  // update() below) instead of a hard visibility gate, so the cross fades in
  // smoothly as crossGlow ramps rather than popping in at a threshold.
  const CROSS_RED = new THREE.Color('#ff2318');
  const CROSS_BLACK = new THREE.Color('#000000');
  let cross;
  const crossMaterials = [];
  if (crossGltf) {
    cross = crossGltf.scene;
    const box = new THREE.Box3().setFromObject(cross);
    cross.scale.setScalar(1.7 / box.getSize(new THREE.Vector3()).y);
    cross.traverse((o) => {
      if (o.isMesh) {
        o.material = new THREE.MeshBasicMaterial({ color: '#000000' });
        crossMaterials.push(o.material);
      }
    });
  } else {
    cross = new THREE.Group();
    const barMat = new THREE.MeshBasicMaterial({ color: '#000000' });
    crossMaterials.push(barMat);
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 0.12), barMat);
    const h = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.16, 0.12), barMat);
    h.position.y = 0.45;
    cross.add(v, h);
  }
  altarAnchor.add(cross);

  const crossLight = new THREE.PointLight('#c1170f', 0, 22, 1.6);
  altarAnchor.add(crossLight);

  if (typeof window !== 'undefined' && window.__DEBUG_CHAPEL__) {
    altarAnchor.updateWorldMatrix(true, true);
    const wb = new THREE.Box3().setFromObject(cross);
    console.log('DEBUG_CROSS', JSON.stringify({
      altarAnchorPos: altarAnchor.position.toArray(),
      crossWorldBoxMin: wb.min.toArray(),
      crossWorldBoxMax: wb.max.toArray(),
      hasCrossGltf: !!crossGltf,
    }));
  }

  let lastLitCount = 0;

  return {
    TOTAL,
    update(candleT, crossGlow, elapsed) {
      const litBefore = lastLitCount;
      const litIdx = [];
      candles.forEach((c, i) => {
        const k = candleIntensity(candleT, i, TOTAL);

        // Each flame gets its own phase, so fourteen candles never pulse in
        // unison -- which is what made them read as a row of lamps rather
        // than as fire. Three incommensurate rates keep the flicker from
        // settling into an obvious loop.
        const ph = i * 2.399;
        const fast = Math.sin(elapsed * 13.7 + ph);
        const mid = Math.sin(elapsed * 6.1 + ph * 1.7);
        const slow = Math.sin(elapsed * 2.3 + ph * 0.6);
        const flick = 0.72 + 0.16 * fast + 0.08 * mid + 0.04 * slow;

        c.flame.material.opacity = k * (0.82 + 0.18 * flick);
        // A flame stretches as it draws up and squats as it gutters, and
        // leans with the draught rather than standing perfectly plumb.
        c.flame.scale.set(0.17 * (0.92 + 0.1 * mid), 0.30 * flick * 1.25, 1);
        c.flame.position.x = 0.012 * slow + 0.006 * fast;
        c.flame.position.y = 0.36 + 0.012 * flick;

        // The halo answers to the flame, a beat behind, so the pool of light
        // swells after the fire does.
        c.halo.material.opacity = k * 0.34 * (0.7 + 0.3 * slow);
        const haloS = 0.95 * (0.9 + 0.14 * slow);
        c.halo.scale.set(haloS, haloS, 1);

        if (k > 0.15) litIdx.push(i);
      });
      // Report each new catch exactly once, so a sound can follow it. Only
      // counted upward: scrubbing back must not fire a burst of ignitions.
      if (litIdx.length > litBefore) onCandleLit?.(litIdx.length - litBefore);
      lastLitCount = litIdx.length;

      // Real lights track the last-lit candles (highest indices).
      lights.forEach((l, j) => {
        const idx = litIdx[litIdx.length - 1 - j];
        if (idx === undefined) { l.intensity = 0; return; }
        const side = idx % 2 === 0 ? -1 : 1;
        l.position.set(side * 0.9, 0.95, CANDLE_Z0 - (idx / TOTAL) * CANDLE_Z_SPAN);
        // task-12: was 3.2, doubled while fighting the post.js gamma bug
        // (see world.js light comments) — 1.6 reads correctly now that the
        // final pass actually encodes to sRGB.
        l.intensity = 1.6 * (0.85 + 0.15 * Math.sin(elapsed * 13 + idx));
      });
      // Neon cross hum + altar wash. Fade the material color (black -> red)
      // by crossGlow every frame instead of a hard `visible` gate, so the
      // cross is already glowing through the doorway as crossGlow ramps up
      // during the threshold act (see timeline.js) rather than popping in.
      const flicker = 0.92 + 0.08 * Math.sin(elapsed * 30) * Math.sin(elapsed * 7.3);
      const glow = Math.min(1, Math.max(0, crossGlow));
      crossMaterials.forEach((m) => m.color.copy(CROSS_BLACK).lerp(CROSS_RED, glow));
      // task-12: was *14, moderated alongside the other lights (see world.js).
      crossLight.intensity = glow * 7 * flicker;
      if (typeof window !== 'undefined' && window.__DEBUG_CHAPEL__) {
        window.__crossDebug = {
          crossGlow, crossLightIntensity: crossLight.intensity,
          crossWorldPos: cross.getWorldPosition(new THREE.Vector3()).toArray(),
          litCandleCount: litIdx.length,
        };
      }
    },
  };
}
