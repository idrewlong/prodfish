import { describe, it, expect } from 'vitest';
import { actsFor } from '../src/choreography.js';
import { JOURNEY_VH } from '../src/journey.js';
import { routeLength, tRow, tNearest, FORK, T_FORK_SCROLL } from '../src/world/path.js';

describe('actsFor', () => {
  for (const route of ['direct', 'work']) {
    it(`${route}: spans are contiguous from 0 to 1`, () => {
      let cursor = 0;
      for (const [start, end] of Object.values(actsFor(route))) {
        expect(start).toBeCloseTo(cursor, 5);
        expect(end).toBeGreaterThan(start);
        cursor = end;
      }
      expect(cursor).toBeCloseTo(1, 5);
    });
    it(`${route}: reaches the fork within its approach act`, () => {
      // Both roads must reach the signpost at the SAME scroll fraction --
      // that is what lets a route switch preserve the camera's position and
      // the reader's scroll position at once. The church road splits its
      // approach at the fork and carries on to the door; the scenic road
      // ends its approach there and hands over to the ride out. Either way
      // the fork must fall inside the act.
      const [start, end] = actsFor(route).approach;
      expect(T_FORK_SCROLL).toBeGreaterThanOrEqual(start);
      expect(T_FORK_SCROLL).toBeLessThanOrEqual(end);
    });
  }

  it('the church road keeps its five acts unchanged', () => {
    expect(Object.keys(actsFor('direct'))).toEqual(
      ['arrival', 'approach', 'threshold', 'chapel', 'beats'],
    );
  });

  it('the scenic road adds the ride, the row, the chapel and the road back', () => {
    expect(Object.keys(actsFor('work'))).toEqual(
      ['arrival', 'approach', 'ride', 'row', 'chapelWork', 'return', 'threshold', 'chapel', 'beats'],
    );
  });

  it('gives the rider’s chapel enough scroll to read a wall of text', () => {
    const acts = actsFor('work');
    const vh = (acts.chapelWork[1] - acts.chapelWork[0]) * JOURNEY_VH.work;
    expect(vh).toBeGreaterThan(400);
  });
});

describe('monument row pacing', () => {
  // The bug these guard: the row previously inherited the church road's
  // fractions, so a stretch of road three times longer got the same slice
  // of scroll and the stones flew past far too fast to read.
  const acts = actsFor('work');
  const L = routeLength('work');
  const row = tRow('work');

  it('gives the row a slower scroll pace than the ride out to it', () => {
    const rowMetres = (row.end - row.start) * L;
    const rideMetres = (row.start - tNearest(FORK, 'work')) * L;
    const rowVhPerMetre = ((acts.row[1] - acts.row[0]) * JOURNEY_VH.work) / rowMetres;
    const rideVhPerMetre = ((acts.ride[1] - acts.ride[0]) * JOURNEY_VH.work) / rideMetres;
    expect(rowVhPerMetre).toBeGreaterThan(rideVhPerMetre * 1.4);
  });

  it('gives each stone enough scroll to be read', () => {
    const rowVh = (acts.row[1] - acts.row[0]) * JOURNEY_VH.work;
    expect(rowVh / 10).toBeGreaterThan(120);
  });
});
