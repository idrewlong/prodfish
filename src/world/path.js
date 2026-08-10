import * as THREE from 'three';

// Named world landmarks (meters, y = eye height-ish). The world is built to
// fit these — models are scaled/positioned to the path, never the reverse.
// Doorway plane is z = 0; interior extends to negative z.
export const LANDMARKS = {
  START:      new THREE.Vector3(0, 2.2, 46),
  FIELD_MID:  new THREE.Vector3(1.8, 1.9, 30),
  BEND:       new THREE.Vector3(-1.6, 1.7, 18),
  GATE:       new THREE.Vector3(0.6, 1.6, 10),
  DOOR_FRONT: new THREE.Vector3(0, 1.55, 3.2),
  DOOR:       new THREE.Vector3(0, 1.5, 0),
  AISLE_IN:   new THREE.Vector3(0, 1.5, -3),
  AISLE_MID:  new THREE.Vector3(0, 1.5, -7),
  ALTAR_STOP: new THREE.Vector3(0, 1.6, -10.5),
};

const curve = new THREE.CatmullRomCurve3(
  [
    LANDMARKS.START, LANDMARKS.FIELD_MID, LANDMARKS.BEND, LANDMARKS.GATE,
    LANDMARKS.DOOR_FRONT, LANDMARKS.DOOR, LANDMARKS.AISLE_IN,
    LANDMARKS.AISLE_MID, LANDMARKS.ALTAR_STOP,
  ],
  false,
  'centripetal',
  0.5,
);

export function positionAt(t) {
  return curve.getPointAt(THREE.MathUtils.clamp(t, 0, 1));
}

// Look slightly ahead along the path; near the end, hold on the altar wall.
export function targetAt(t) {
  const ahead = Math.min(THREE.MathUtils.clamp(t, 0, 1) + 0.04, 1);
  const p = curve.getPointAt(ahead);
  if (ahead === 1) p.z -= 2;
  return p;
}

// Arc-length t whose point is nearest to `point` (sampled search).
export function tNearest(point) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i <= 400; i++) {
    const t = i / 400;
    const d = curve.getPointAt(t).distanceToSquared(point);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

export const T_GATE = tNearest(LANDMARKS.GATE);
export const T_DOOR = tNearest(LANDMARKS.DOOR);
export const T_ALTAR = tNearest(LANDMARKS.ALTAR_STOP);
