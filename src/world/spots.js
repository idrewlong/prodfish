// Hand-placed positions for the props that dress the churchyard. Data only —
// no geometry, no three import — so both world.js and groundcover.js (which
// keeps grass out of the grave footprints) can read it without a cycle.


// Hand-placed prop spots [x, z, rotY, scale] flanking the path's S-curve.
// Deterministic (no Math.random) so the corridor-clearance test is real.
export const PROP_SPOTS = {
  // Ghost-Rider-graveyard density: a near flanking row hugging the road plus
  // a second row set further back, so the approach reads as a dense field of
  // leaning stones receding into the fog rather than scattered set dressing.
  graves: [
    // near row (original 10)
    [-3.2, 34, 0.3, 1], [3.6, 31, -0.2, 0.9], [-2.8, 27, 0.8, 1.1],
    [4.2, 24, -0.5, 1], [-4.5, 21, 0.1, 0.85], [3.4, 17, 0.6, 1],
    [-3.0, 14, -0.4, 0.95], [3.8, 12, 0.2, 1.05], [-3.6, 8.5, -0.7, 1],
    [3.1, 6.5, 0.4, 0.9],
    // near row, extended further out toward the misty horizon
    [-3.4, 41, 0.5, 1], [3.9, 38, -0.3, 0.95],
    // far row, set back beyond the trees for depth
    [-6.0, 33, 0.2, 1], [6.4, 29.5, -0.6, 0.9], [-5.8, 25.5, 0.9, 1.05],
    [6.6, 22.5, -0.1, 0.85], [-6.2, 19, 0.4, 1], [6.0, 15.5, -0.5, 0.95],
    [-5.6, 10.5, 0.3, 1], [5.9, 7.5, -0.4, 0.9],
  ],
  // Nudged outward when the trees became live oaks. The old AI-generated
  // trees were ~4.5m across at this height; the oak is ~6.9m, so spots that
  // used to read as "tree behind a headstone" became a trunk standing on top
  // of one -- worst on the right at 1.39m and 1.58m. Every tree now keeps
  // 2.7m from the nearest marker, which took at most 1.4m of movement, so the
  // avenue's shape is unchanged. Path clearance only went up.
  trees: [
    [-6.5, 38, 0, 1.1], [7, 33, 1.2, 1], [-8.5, 26, 2.1, 0.9],
    [6.2, 19.8, 0.4, 1.2], [-6.1, 13.2, 2.8, 1], [8.6, 8, 1.7, 0.95],
    [7.8, 43, 0.9, 1], [-8.0, 30, 1.5, 0.95], [8.7, 16, 2.3, 1.05], [-6.8, 5.5, 0.6, 0.9],
  ],
};

// Figures standing back among the trees, motionless, never acknowledged.
//
// They are lit by nothing special: the lightning in weather.js is a real
// DirectionalLight, so a strike rakes them exactly as it rakes the treeline,
// and they simply become visible for the half-second it lasts. That is the
// whole effect, and it needs no per-frame code at all — which is also why it
// will always stay in sync with the weather rather than drifting from it.
//
// [x, z, rotY] — each is turned to face the road, so whichever way the
// visitor is looking when a strike lands, it is looking back.
export const WATCHER_SPOTS = [
  [-9.2, 22.0, 1.35],
  [9.5, 29.0, -1.25],
  [-8.0, 35.0, 1.15],
];
