export const TIERS = {
  // grass is a TUFT count, not a blade count: each tuft is 3 blades on low
  // and 6 on high, so high tier draws ~12k blades across 2000 clumps.
  low:  { particles: 60,  dprCap: 1.5, candleLights: 2, crows: 3, grass: 700 },
  high: { particles: 140, dprCap: 2,   candleLights: 6, crows: 5, grass: 2000 },
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
