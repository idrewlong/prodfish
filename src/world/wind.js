// The scene's one wind clock.
//
// Every piece of vegetation — the graveyard grass, the swamp reeds, the pine
// treeline and the swamp trees with their moss — bends off this single
// uniform, so one gust crosses all of them together rather than each system
// running its own weather. It lives in its own module because both world.js
// and trees.js need it and they already depend on each other in one
// direction; sharing it through either would be a cycle.
export const windUniforms = { uWind: { value: 0 } };

export function setWind(t) {
  windUniforms.uWind.value = t;
}

// The direction the wind blows, in world XZ. Shared so the grass, the
// treeline and the moss all lean the same way.
export const WIND_DIR = [0.82, 0.57];
