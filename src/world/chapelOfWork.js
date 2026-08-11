import * as THREE from 'three';
import { positionAt } from './path.js';
import { makeEngravedTexture, ENGRAVED_STONE_INK } from './engraving.js';
import { BIO, CATALOG_URL, SOCIALS } from '../content/portfolio.js';

// The rider's chapel: the destination of the scenic road, standing where the
// monument row ends and the road turns for home. The road runs THROUGH it —
// in at the near door, out at the far one — so the journey stays one
// continuous ride rather than introducing a second kind of movement.
//
// Placement is measured against the road, not eyeballed: the values below
// are the road's own position and heading at t = 0.630, sampled from the
// work curve. The building is oriented so its long axis lies along the
// direction of travel, which is what lets the camera pass straight through.
//
// It sits further down the road than the monument row's end, and that gap
// is load-bearing rather than aesthetic: at the first placement (t=0.546)
// the nearest song stone was 3.0m from the building's centre, i.e. standing
// INSIDE the room — a gravestone in the middle of the floor, plainly
// visible in screenshots. 8.2m clears the 7x11m footprint and its
// keep-out with room to spare.
export const CHAPEL_CENTRE = [47.1, 6.3];
export const CHAPEL_ROT_Y = -1.674;
export const CHAPEL_T = 0.630;

// Inside dimensions. The doorway height is the number that matters: the
// church taught this lesson painfully — scaling a building by its overall
// silhouette shrank its door below the eye-height camera, and the camera
// sailed over the top of it.
const DOOR_H = 2.7;
const DOOR_W = 2.2;
const ROOM_W = 7;
const ROOM_L = 11;
const WALL_H = 4.2;

// How far the rider and the motorcycle stand from the road's centre line.
// Anything closer than the corridor the stones are held to would be driven
// through.
export const RIDER_OFFSET = 2.4;
// Wider than the rider's: the bike stands OUTSIDE the near door, where the
// road is still bending into the building, so an offset that clears the
// corridor inside does not clear it out there.
export const BIKE_OFFSET = 4.0;

// Distance from the building's centre to each doorway along its axis.
export const DOOR_DISTANCE = ROOM_L / 2;

// Where a prop sits, given metres along the road's direction and metres to
// the side. Exported so tests can check clearance without re-deriving the
// building's frame.
export function chapelLocal(alongM, sideM) {
  const c = Math.cos(CHAPEL_ROT_Y);
  const s = Math.sin(CHAPEL_ROT_Y);
  // Local +z runs along the direction of travel; local +x is to its right.
  return [
    CHAPEL_CENTRE[0] + s * alongM + c * sideM,
    CHAPEL_CENTRE[1] + c * alongM - s * sideM,
  ];
}

export function riderSpot() {
  return chapelLocal(1.5, RIDER_OFFSET);
}

export function bikeSpot() {
  return chapelLocal(-DOOR_DISTANCE - 2.2, BIKE_OFFSET);
}

// A wall with a doorway cut through it, built as four slabs rather than with
// CSG: the opening is a plain rectangle, so four boxes are exact, cheaper,
// and cannot produce the degenerate geometry a boolean can.
function wallWithDoorway(mat) {
  const g = new THREE.Group();
  const side = (ROOM_W - DOOR_W) / 2;
  const left = new THREE.Mesh(new THREE.BoxGeometry(side, WALL_H, 0.3), mat);
  left.position.set(-(DOOR_W / 2 + side / 2), WALL_H / 2, 0);
  const right = left.clone();
  right.position.x = DOOR_W / 2 + side / 2;
  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(DOOR_W, WALL_H - DOOR_H, 0.3), mat,
  );
  lintel.position.set(0, DOOR_H + (WALL_H - DOOR_H) / 2, 0);
  g.add(left, right, lintel);
  return g;
}

// Words cut into the plaster, same technique as the song stones: the canvas
// carries letterform alpha only and the material colour is the ink.
function carvedPanel(text, widthM, basePx) {
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(widthM, widthM * 0.26),
    new THREE.MeshBasicMaterial({
      map: makeEngravedTexture(text, { widthPx: 900, heightPx: 234, basePx }),
      transparent: true,
      color: ENGRAVED_STONE_INK,
      depthWrite: false,
    }),
  );
  return plane;
}

export function buildChapelOfWork({ scene, riderGltf, bikeGltf, normalizeProp }) {
  const group = new THREE.Group();
  group.position.set(CHAPEL_CENTRE[0], 0, CHAPEL_CENTRE[1]);
  group.rotation.y = CHAPEL_ROT_Y;

  const plaster = new THREE.MeshStandardMaterial({ color: '#3a352c', roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1b1813', roughness: 1 });

  // Side walls, floor, roof.
  const sideGeo = new THREE.BoxGeometry(0.3, WALL_H, ROOM_L);
  const wallL = new THREE.Mesh(sideGeo, plaster);
  wallL.position.set(-ROOM_W / 2, WALL_H / 2, 0);
  const wallR = wallL.clone();
  wallR.position.x = ROOM_W / 2;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, 0.1, ROOM_L), dark);
  floor.position.y = 0.05;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W + 0.6, 0.3, ROOM_L + 0.6), dark);
  roof.position.y = WALL_H;
  group.add(wallL, wallR, floor, roof);

  // Doorways at both ends: the road goes in one and out the other.
  const nearWall = wallWithDoorway(plaster);
  nearWall.position.z = -DOOR_DISTANCE;
  const farWall = wallWithDoorway(plaster);
  farWall.position.z = DOOR_DISTANCE;
  group.add(nearWall, farWall);

  // Carved into the FAR wall, flanking the doorway the road leaves by, and
  // turned to face the incoming camera. An earlier version put them on a
  // side wall reasoning they would be read side-on while drifting past --
  // but the camera looks FORWARD along the road, so a side wall never
  // enters frame and the whole wall of text was invisible.
  const panels = new THREE.Group();
  panels.position.set(0, 0, DOOR_DISTANCE - 0.22);
  panels.rotation.y = Math.PI;

  const bio = carvedPanel(BIO.split('. ')[0], 6.2, 40);
  bio.position.set(0, 3.35, 0);
  panels.add(bio);

  const links = [];
  const sideX = DOOR_W / 2 + (ROOM_W - DOOR_W) / 4;
  SOCIALS.forEach((social, i) => {
    const panel = carvedPanel(social.label, 1.9, 82);
    // Stacked either side of the doorway, alternating, so none sits in the
    // opening the camera passes through.
    panel.position.set(i % 2 === 0 ? -sideX : sideX, 2.35 - Math.floor(i / 2) * 0.62, 0);
    panel.userData.href = social.url;
    panel.userData.textMesh = panel;
    panels.add(panel);
    links.push(panel);
  });

  const catalog = carvedPanel('the full catalog', 2.0, 82);
  catalog.position.set(SOCIALS.length % 2 === 0 ? -sideX : sideX,
    2.35 - Math.floor(SOCIALS.length / 2) * 0.62, 0);
  catalog.userData.href = CATALOG_URL;
  catalog.userData.textMesh = catalog;
  panels.add(catalog);
  links.push(catalog);

  group.add(panels);

  // A low fire glow rather than the church's red neon, so the two interiors
  // read as different places.
  // The fire has to light a wall of text at the far end, so it sits toward
  // that end rather than beside the entrance.
  const fire = new THREE.PointLight('#ff7a2a', 26, 26, 1.5);
  fire.position.set(1.8, 1.9, DOOR_DISTANCE - 3.2);
  group.add(fire);
  const fill = new THREE.PointLight('#ffb066', 12, 18, 1.6);
  fill.position.set(-1.2, 2.4, 0);
  group.add(fill);

  scene.add(group);

  // The rider stands inside, off to one side of the road, lit by the fire.
  if (riderGltf) {
    const rider = normalizeProp(riderGltf.scene.clone(true), 2.0);
    const [rx, rz] = riderSpot();
    rider.position.set(rx, 0, rz);
    rider.rotation.y = CHAPEL_ROT_Y + Math.PI;
    scene.add(rider);
  }

  // The bike stands outside the near door, angled across the trail.
  if (bikeGltf) {
    const bike = normalizeProp(bikeGltf.scene.clone(true), 1.15);
    const [bx, bz] = bikeSpot();
    bike.position.set(bx, 0, bz);
    bike.rotation.y = CHAPEL_ROT_Y + 0.9;
    scene.add(bike);
  }

  return { group, links };
}

// Smallest distance from a prop spot to the scenic road — the camera drives
// straight through this building, so anything it passes must clear it.
export function clearanceFromRoad(x, z) {
  let min = Infinity;
  for (let i = 0; i <= 400; i++) {
    const p = positionAt(i / 400, 'work');
    min = Math.min(min, Math.hypot(p.x - x, p.z - z));
  }
  return min;
}
