// grass is a TUFT count, not a blade count: each tuft is 3 blades on low and
// 6 on high, so high tier draws ~12k blades across 2000 clumps.
//
// The low tier is sized for a PHONE and had drifted badly out of budget: it
// was drawing 237,000 triangles at a 1.5 pixel ratio, which on a 1320px-wide
// screen is 7.1 megapixels, and then running a full-screen post pass over all
// of it. dprCap is the single biggest lever here -- dropping it to 1 cuts the
// fragment work by 2.25x on its own, and the scene is grainy, foggy and dark
// by design, so it is the resolution that shows least.
export const TIERS = {
  low: {
    particles: 60,
    dprCap: 1,
    candleLights: 2,
    crows: 3,
    grass: 500,
    // Fraction of the hand-placed props to keep (nearest the path first).
    propFraction: 0.45,
    boulders: 6,
    // Big overlapping transparent sheets are the classic mobile fill-rate
    // killer, and five of them is also what made the fog read as soup on a
    // small screen.
    mist: 2,
    mistOpacity: 0.6,
    groundStep: 1.2,
    // Chromatic aberration splits the colour channels; at a low pixel ratio
    // that lands as visible red/green/magenta fringing rather than as a
    // filmic hint, which is the "RGB hue" on the phone screenshots.
    chromatic: 0,
    grain: 0.01,
  },
  high: {
    particles: 140,
    dprCap: 2,
    candleLights: 6,
    crows: 5,
    grass: 2000,
    propFraction: 1,
    boulders: 11,
    mist: 5,
    mistOpacity: 1,
    groundStep: 0.7,
    chromatic: 0.0015,
    grain: 0.018,
  },
};

export function deviceTier({ isMobileUA = false, memory, cores } = {}) {
  if (isMobileUA) return 'low';
  if (memory !== undefined && memory <= 4) return 'low';
  if (cores !== undefined && cores <= 4) return 'low';
  return 'high';
}

// iPadOS Safari reports a DESKTOP user agent ("Macintosh"), so the UA test
// alone silently handed every iPad the high tier — 1000 grass tufts, six
// candle lights and a 2x pixel ratio on a tablet GPU. A Mac that reports more
// than one touch point is, in practice, an iPad.
export function isTouchTablet({ userAgent = '', maxTouchPoints = 0 } = {}) {
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

export function detectTier() {
  const ua = navigator.userAgent;
  return deviceTier({
    isMobileUA: /Mobi|Android|iPhone|iPad/i.test(ua)
      || isTouchTablet({ userAgent: ua, maxTouchPoints: navigator.maxTouchPoints }),
    memory: navigator.deviceMemory,
    cores: navigator.hardwareConcurrency,
  });
}
