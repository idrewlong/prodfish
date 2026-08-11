// Scroll progress spans (0..1) for the five acts of the experience.
export const ACTS = {
  arrival:   [0.00, 0.15], // black -> title -> exterior emerges
  approach:  [0.15, 0.45], // dolly through the grass toward the church
  threshold: [0.45, 0.62], // door closeup, red glow, blackout
  chapel:    [0.62, 0.82], // red interior fades in, drift down the aisle
  beats:     [0.82, 1.00], // beatstars altar + socials (in-flow DOM)
};

// Shared animation state. The timeline tweens this; the scene manager
// reads it every frame. DOM overlays are tweened directly by GSAP.
export function createState() {
  return {
    pathT: 0,        // 0..1 position along the camera path (arc length)
    doorT: 0,        // 0..1 chapel door swing
    crowT: 0,        // 0..1 crow-scatter progress
    candleT: 0,      // 0..1 candle ignition progress down the aisle
    swayAmp: 1,      // ambient camera sway multiplier
    fog: 0.022,      // FogExp2 density
    fireflies: 0,    // firefly particle opacity
    crossGlow: 0,    // neon cross + altar light intensity
  };
}
