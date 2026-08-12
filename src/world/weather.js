import * as THREE from 'three';

// Distant lightning. Rare and brief on purpose: a flash every few seconds
// would read as a strobe, but one every half-minute or so is a thing people
// remember, and it is the only moment the whole treeline is revealed at once.
//
// The timing is deliberately NOT scroll-driven. Everything else in this scene
// answers to the scrollbar; weather that also did would feel authored rather
// than weather. It runs on its own clock, which also means it still happens
// for a visitor who has stopped scrolling to read.
const MIN_GAP = 14;
const MAX_GAP = 34;

// A strike is a short burst of 2-3 flickers, like a real distant strike
// rather than a single fade.
export function flashIntensity(sinceStrike) {
  if (sinceStrike < 0) return 0;
  if (sinceStrike > 0.62) return 0;
  const envelope = Math.exp(-sinceStrike * 5.5);
  const flicker = 0.55
    + 0.45 * Math.sin(sinceStrike * 46)
    * Math.sin(sinceStrike * 17 + 1.1);
  return Math.max(0, envelope * flicker);
}

// Thunder follows the flash by the time sound takes to cross the distance.
export function thunderDelay(distanceM) {
  return distanceM / 343;
}

export function createWeather(scene, { onThunder } = {}) {
  // Sits out beyond the treeline, so a strike rakes the woods and the church
  // from the side rather than lighting the camera's own patch of ground.
  const light = new THREE.DirectionalLight('#cfe0ff', 0);
  light.position.set(-52, 34, 58);
  scene.add(light);

  let nextStrike = 6 + Math.random() * MAX_GAP;
  let strikeAt = -99;
  let thunderPending = false;

  return {
    update(elapsed) {
      if (elapsed >= nextStrike) {
        strikeAt = elapsed;
        thunderPending = true;
        nextStrike = elapsed + MIN_GAP + Math.random() * (MAX_GAP - MIN_GAP);
      }
      const since = elapsed - strikeAt;
      light.intensity = flashIntensity(since) * 5.5;

      if (thunderPending && since > thunderDelay(2600)) {
        thunderPending = false;
        onThunder?.();
      }
    },
  };
}
