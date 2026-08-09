export const TIERS = {
  low: { segments: 64, particles: 60, dprCap: 1.5 },
  high: { segments: 160, particles: 140, dprCap: 2 },
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
