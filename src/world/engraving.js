import * as THREE from 'three';

// Words carved into wood, not printed on it. The canvas carries ONLY the
// letterform alpha (solid white on transparent); the mesh material supplies
// the colour. That split is what lets a hover light the letters by changing
// one material colour, with no canvas redraw and no second texture.
export const ENGRAVED_INK = 0x0d0a08; // cut into the shadowed grain
export const ENGRAVED_LIT = 0xe8c98a; // catching a little lantern light

// Average glyph width for this face is close enough to 0.5em for fitting a
// short sign legend; measuring per-glyph would need a canvas, and this runs
// in tests where there isn't one.
const AVG_GLYPH_EM = 0.5;
const MIN_FONT_PX = 8;

export function fitFontPx(text, maxWidthPx, basePx) {
  const chars = Math.max(text.length, 1);
  const fitted = maxWidthPx / (chars * AVG_GLYPH_EM);
  return Math.max(MIN_FONT_PX, Math.min(basePx, Math.floor(fitted)));
}

export function makeEngravedTexture(text, { widthPx = 512, heightPx = 128, basePx = 76 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');

  const fontPx = fitFontPx(text, widthPx * 0.88, basePx);
  ctx.font = `${fontPx}px Georgia, "Times New Roman", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // A carved letter is a groove: a dark cut with a bright lip along its top
  // edge where the light catches. Drawing the lip slightly offset and then
  // the cut over it gives that read at a glance, without a normal map.
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText(text, widthPx / 2, heightPx / 2 - fontPx * 0.045);
  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.fillText(text, widthPx / 2, heightPx / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}
