// The one deterministic random source the world is built from. Lives on its
// own because ground.js and groundcover.js both seed from it, and importing
// it from world.js would make the dependency circular.


// Small deterministic PRNG (LCG) so grass placement is stable frame-to-frame
// and across reloads — Math.random() would reshuffle every build, making the
// "avoid the path corridor" clearance impossible to reason about or test.
export function makeLcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
