import { describe, it, expect } from 'vitest';
import {
  CHAPEL_CENTRE, CHAPEL_T, DOOR_DISTANCE,
  chapelLocal, riderSpot, bikeSpot, clearanceFromRoad,
} from '../src/world/chapelOfWork.js';
import { positionAt, tRow } from '../src/world/path.js';
import { SOCIALS, BIO, CATALOG_URL } from '../src/content/portfolio.js';
import { MONUMENT_SPOTS } from '../src/world/monuments.js';
import { CHAPEL_KEEP_OUT } from '../src/world/world.js';

describe('the rider’s chapel', () => {
  it('straddles the scenic road, so the camera drives through it', () => {
    // The whole design rests on this: the road runs in one door and out the
    // other. If the building drifted off the road the visitor would sail
    // past the outside of it.
    expect(clearanceFromRoad(...CHAPEL_CENTRE)).toBeLessThan(1.0);
  });

  it('sits at the far end of the monument row, where the road turns home', () => {
    const row = tRow('work');
    expect(CHAPEL_T).toBeGreaterThan(row.end);
    expect(CHAPEL_T).toBeLessThan(row.end + 0.12);
  });

  it('puts both doorways on the road, not the walls', () => {
    // Sample the road either side of the building's centre and check it
    // still runs close to the building's axis at those points.
    const before = positionAt(CHAPEL_T - 0.012, 'work');
    const after = positionAt(CHAPEL_T + 0.012, 'work');
    expect(clearanceFromRoad(before.x, before.z)).toBeLessThan(0.5);
    expect(clearanceFromRoad(after.x, after.z)).toBeLessThan(0.5);
    expect(DOOR_DISTANCE).toBeGreaterThan(3);
  });

  it('keeps the rider and the bike out of the camera corridor', () => {
    // The camera drives straight through this building; anything standing
    // in the corridor gets driven through.
    expect(clearanceFromRoad(...riderSpot())).toBeGreaterThan(1.4);
    expect(clearanceFromRoad(...bikeSpot())).toBeGreaterThan(1.4);
  });

  it('places props relative to the road’s own heading', () => {
    // Zero offset must land on the building's centre; a side offset must
    // actually move sideways.
    const [cx, cz] = chapelLocal(0, 0);
    expect(Math.hypot(cx - CHAPEL_CENTRE[0], cz - CHAPEL_CENTRE[1])).toBeLessThan(0.001);
    const [sx, sz] = chapelLocal(0, 3);
    expect(Math.hypot(sx - CHAPEL_CENTRE[0], sz - CHAPEL_CENTRE[1])).toBeCloseTo(3, 5);
  });

  it('has social links and a bio to carve', () => {
    expect(SOCIALS.length).toBeGreaterThanOrEqual(3);
    for (const s of SOCIALS) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.url).toMatch(/^https?:\/\//);
    }
    expect(BIO.length).toBeGreaterThan(80);
    expect(CATALOG_URL).toMatch(/^https?:\/\//);
  });
});

describe('the chapel’s clearing', () => {
  it('stands clear of every song stone, so none is left inside the room', () => {
    // The first placement put the nearest stone 3.0m from the building's
    // centre -- a gravestone standing in the middle of the floor.
    for (const [x, z] of MONUMENT_SPOTS) {
      expect(Math.hypot(x - CHAPEL_CENTRE[0], z - CHAPEL_CENTRE[1]))
        .toBeGreaterThan(CHAPEL_KEEP_OUT);
    }
  });
});
