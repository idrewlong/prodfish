export const TIERS = {
  low:  { particles: 60,  dprCap: 1.5, candleLights: 2, crows: 3, grass: 350 },
  high: { particles: 140, dprCap: 2,   candleLights: 6, crows: 5, grass: 1000 },
};

export function deviceTier({ isMobileUA = false, memory, cores } = {}) {
  if (isMobileUA) return 'low';
  if (memory !== undefined && memory <= 4) return 'low';
  if (cores !== undefined && cores <= 4) return 'low';
  return 'high';
}

export function detectTier() {
  return deviceTier({
    isMobileUA: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent),
    memory: navigator.deviceMemory,
    cores: navigator.hardwareConcurrency,
  });
}
