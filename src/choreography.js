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
    camZ: 14,
    camY: 0,
    swayAmp: 1,          // ambient camera sway multiplier
    exteriorOpacity: 0,
    thresholdOpacity: 0,
    interiorOpacity: 0,
    fog: 0.15,           // fog mix on the exterior plane
    fireflies: 0,        // firefly particle opacity
  };
}
