import { describe, it, expect } from 'vitest';
import { JOURNEY_VH, trackHeightVh, journeyDistancePx } from '../src/journey.js';
import { T_FORK_SCROLL } from '../src/world/path.js';

describe('journey sizing', () => {
  it('gives the scenic route more scroll than the direct one', () => {
    expect(JOURNEY_VH.work).toBeGreaterThan(JOURNEY_VH.direct);
  });

  it('once chosen, the track is the full height of that route', () => {
    expect(trackHeightVh('direct', true)).toBe(JOURNEY_VH.direct);
    expect(trackHeightVh('work', true)).toBe(JOURNEY_VH.work);
  });

  it('before choosing, the document ends exactly at the fork', () => {
    // Scrollable distance is height minus one viewport. The unchosen track
    // must expose exactly T_FORK_SCROLL of the direct route's scrollable
    // distance, so the timeline can advance to the fork and no further.
    const h = trackHeightVh(null, false);
    const scrollable = h - 100;
    const fullScrollable = JOURNEY_VH.direct - 100;
    expect(scrollable / fullScrollable).toBeCloseTo(T_FORK_SCROLL, 5);
  });

  it('the unchosen track is shorter than either full route', () => {
    expect(trackHeightVh(null, false)).toBeLessThan(JOURNEY_VH.direct);
  });

  it('journey distance is the scrollable pixels of the full route', () => {
    expect(journeyDistancePx('direct', 800)).toBe((JOURNEY_VH.direct / 100 - 1) * 800);
    expect(journeyDistancePx('work', 800)).toBe((JOURNEY_VH.work / 100 - 1) * 800);
  });

  it('journey distance ignores how tall the document currently is', () => {
    // This is the whole point: progress is measured against the full
    // journey, so a short document caps progress instead of compressing
    // the entire timeline into it.
    expect(journeyDistancePx('direct', 800)).toBe(journeyDistancePx('direct', 800));
    expect(journeyDistancePx('direct', 1000)).toBeGreaterThan(journeyDistancePx('direct', 800));
  });

  it('parked scroll maps to true journey progress, not document progress', () => {
    // The lock fraction must be read against the FULL journey. Measuring
    // against the parked document instead ran progress 1/T_FORK_SCROLL too
    // fast and locked the route choice long before the fork.
    const innerHeight = 800;
    const parkedScrollablePx = (trackHeightVh(null, false) - 100) / 100 * innerHeight;
    const progressAtBottom = parkedScrollablePx / journeyDistancePx('direct', innerHeight);
    expect(progressAtBottom).toBeCloseTo(T_FORK_SCROLL, 5);
  });
});
