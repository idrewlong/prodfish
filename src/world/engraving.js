import * as THREE from 'three';

// Words carved into wood, not printed on it. The canvas carries ONLY the
// letterform alpha (solid white on transparent); the mesh material supplies
// the colour. That split is what lets a hover light the letters by changing
// one material colour, with no canvas redraw and no second texture.
// fix-round: 0x0d0a08 (near-black) read as a faint smudge against the
// board's own near-black wood (#241d16) under night lighting -- the carved
// words were nearly illegible in practice, tests notwithstanding. Raised to
// a weathered bone-grey/tan that reads against dark wood while the lip
// highlight below (not flat white) still keeps it looking cut-in rather than
// printed on.
export const ENGRAVED_INK = 0x6b5a44; // cut into the shadowed grain, weathered and legible
export const ENGRAVED_LIT = 0xe8c98a; // catching a little lantern light

// The song titles are cut into pale granite, not the signpost's dark wood,
// so they want the opposite treatment: near-black, which reads as a deep
// shadowed cut against a light surface. The signpost's tan ink would vanish
// on stone. Read from ~3m away at walking pace, so contrast matters more
// than subtlety.
export const ENGRAVED_STONE_INK = 0x1a1512;

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
  // fix-round: the lip was too faint and too close to the cut (0.35 alpha,
  // 0.045em offset) to read as a groove at sign scale -- strengthened both so
  // the carve reads as deep rather than a flat printed word.
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(text, widthPx / 2, heightPx / 2 - fontPx * 0.09);
  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.fillText(text, widthPx / 2, heightPx / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}
