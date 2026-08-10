import * as THREE from 'three';
import { candleIntensity } from './events.js';

const TOTAL = 14;

// Soft radial-gradient texture shared by every flame/halo sprite. Sprites
// always face the camera (unlike a static plane, which can foreshorten to a
// thin sliver or, worse, blow out into a hard-edged rectangle when the
// camera passes close by) and the gradient falloff keeps that close pass
// looking like a glow instead of a flat lit box.
function makeGlowTexture() {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,200,140,0.6)');
  g.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

// Candle rows flank the aisle (x = ±0.9) from just inside the door to the
// altar. Flames are camera-facing additive sprites; a small pool of real
// point lights follows the most recently lit candles so low tiers stay
// cheap.
export function createCandles({ scene, altarAnchor, crossGltf, maxLights }) {
  const candles = [];
  const glowTex = makeGlowTexture();
  const flameMat = new THREE.SpriteMaterial({
    map: glowTex,
    color: '#ff9a3d',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  for (let i = 0; i < TOTAL; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = -2.6 - (i / TOTAL) * 7.4;
    const g = new THREE.Group();
    const wax = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.045, 0.28, 8),
      new THREE.MeshStandardMaterial({ color: '#8f887a', roughness: 0.8 }),
    );
    wax.position.y = 0.14;
    // Flame + a larger, softer halo behind it so the candle reads as a
    // small glowing pool from aisle distance, not just a thin sliver.
    const flame = new THREE.Sprite(flameMat.clone());
    flame.scale.set(0.22, 0.3, 1);
    flame.position.y = 0.37;
    const halo = new THREE.Sprite(flameMat.clone());
    halo.scale.set(0.75, 0.75, 1);
    halo.position.y = 0.37;
    g.add(wax, flame, halo);
    g.position.set(side * 0.9, 0.55, z); // on low pew-end stands
    scene.add(g);
    candles.push({ flame, halo });
  }

  // Shared light pool.
  const lights = Array.from({ length: maxLights }, () => {
    const l = new THREE.PointLight('#ff7a26', 0, 4.5, 2);
    scene.add(l);
    return l;
  });

  // Neon cross: generated GLB if present, else two emissive bars.
  let cross;
  if (crossGltf) {
    cross = crossGltf.scene;
    const box = new THREE.Box3().setFromObject(cross);
    cross.scale.setScalar(1.7 / box.getSize(new THREE.Vector3()).y);
    cross.traverse((o) => {
      if (o.isMesh) o.material = new THREE.MeshBasicMaterial({ color: '#ff2318' });
    });
  } else {
    cross = new THREE.Group();
    const barMat = new THREE.MeshBasicMaterial({ color: '#ff2318' });
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

  return {
    TOTAL,
    update(candleT, crossGlow, elapsed) {
      const litIdx = [];
      candles.forEach((c, i) => {
        const k = candleIntensity(candleT, i, TOTAL);
        c.flame.material.opacity = k;
        c.flame.scale.y = 0.8 + 0.2 * Math.sin(elapsed * 11 + i * 2.1);
        c.halo.material.opacity = k * 0.4;
        if (k > 0.15) litIdx.push(i);
      });
      // Real lights track the last-lit candles (highest indices).
      lights.forEach((l, j) => {
        const idx = litIdx[litIdx.length - 1 - j];
        if (idx === undefined) { l.intensity = 0; return; }
        const side = idx % 2 === 0 ? -1 : 1;
        l.position.set(side * 0.9, 0.95, -2.6 - (idx / TOTAL) * 7.4);
        // task-12: was 3.2, doubled while fighting the post.js gamma bug
        // (see world.js light comments) — 1.6 reads correctly now that the
        // final pass actually encodes to sRGB.
        l.intensity = 1.6 * (0.85 + 0.15 * Math.sin(elapsed * 13 + idx));
      });
      // Neon cross hum + altar wash.
      const flicker = 0.92 + 0.08 * Math.sin(elapsed * 30) * Math.sin(elapsed * 7.3);
      cross.visible = crossGlow > 0.01;
      // task-12: was *14, moderated alongside the other lights (see world.js).
      crossLight.intensity = crossGlow * 7 * flicker;
      if (typeof window !== 'undefined' && window.__DEBUG_CHAPEL__) {
        window.__crossDebug = {
          crossGlow, crossVisible: cross.visible, crossLightIntensity: crossLight.intensity,
          crossWorldPos: cross.getWorldPosition(new THREE.Vector3()).toArray(),
          litCandleCount: litIdx.length,
        };
      }
    },
  };
}
