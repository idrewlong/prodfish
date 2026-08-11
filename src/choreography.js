// Scroll progress spans (0..1) for the five acts of the experience.
export const ACTS = {
  arrival:   [0.00, 0.15], // black -> title -> exterior emerges
  approach:  [0.15, 0.45], // dolly through the grass toward the church
  threshold: [0.45, 0.62], // door closeup, red glow, blackout
  chapel:    [0.62, 0.82], // red interior fades in, drift down the aisle
  beats:     [0.82, 1.00], // beatstars altar + socials (in-flow DOM)
};

// The work road is roughly three times longer than the church road, but the
// fork still sits at the same scroll fraction on both (that is what makes
// switching roads seamless). So it cannot inherit the church road's act
// boundaries: doing that is what crushed the monument row into a tenth of
// the scroll and made the stones fly past unreadably. Each stretch gets its
// own budget instead, with the row deliberately the slowest thing on the
// site — it is the one place a visitor is meant to read rather than travel.
const WORK_ACTS = {
  arrival:   [0.00, 0.10],
  approach:  [0.10, 0.30], // to the signpost — same fraction as the direct road
  ride:      [0.30, 0.40], // out across the field into the low ground
  row:       [0.40, 0.66], // the monument walk: slowest pace on the site
  chapelWork:[0.66, 0.78], // through the rider's chapel: a wall to read
  return:    [0.78, 0.90], // the long road back toward the church
  threshold: [0.90, 0.95], // through the church door
  chapel:    [0.95, 0.985],
  beats:     [0.985, 1.00],
};

export function actsFor(route) {
  return route === 'work' ? WORK_ACTS : ACTS;
}

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
    route: 'direct',  // 'direct' | 'work' — which road we are walking
  };
}
