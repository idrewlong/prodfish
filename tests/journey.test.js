import { describe, it, expect } from 'vitest';
import { JOURNEY_VH, journeyDistancePx, journeyTrackPx, trackPxWithChapel } from '../src/journey.js';

describe('journey sizing', () => {
  it('is one number for one road', () => {
    expect(typeof JOURNEY_VH).toBe('number');
    expect(JOURNEY_VH).toBeGreaterThan(100);
  });

  it('spans the scrollable pixels of the journey, not the document', () => {
    // Derived from the journey rather than the document's current height, so
    // the timeline cannot be squeezed or stretched by unrelated layout.
    expect(journeyDistancePx(800)).toBe((JOURNEY_VH / 100 - 1) * 800);
  });

  it('scales with the viewport', () => {
    expect(journeyDistancePx(1000)).toBeGreaterThan(journeyDistancePx(800));
  });
});

describe('trackPxWithChapel', () => {
  it('changes nothing when the chapel is one viewport tall', () => {
    expect(trackPxWithChapel(800, 800)).toBe(journeyTrackPx(800));
  });

  it('adds only the pixels the chapel exceeds one viewport by', () => {
    // Three stations on an 800px viewport: the journey keeps its 16 screens
    // and the extra 1600px becomes post-journey scroll.
    expect(trackPxWithChapel(800, 2400)).toBe(journeyTrackPx(800) + 1600);
  });

  it('never shrinks the track for a chapel shorter than the viewport', () => {
    expect(trackPxWithChapel(800, 200)).toBe(journeyTrackPx(800));
  });

  it('leaves exactly the journey above the chapel, whatever the chapel weighs', () => {
    // The invariant the whole change rests on. track = 15V + C, so the
    // document ABOVE the chapel is always 15V -- journeyDistancePx -- and the
    // chapel's top edge lands where the timeline ends no matter how tall it
    // grows. If this breaks, the chapel starts framing itself mid-walk.
    for (const chapelPx of [800, 2400, 5000]) {
      expect(trackPxWithChapel(800, chapelPx) - chapelPx).toBe(journeyDistancePx(800));
    }
    expect(journeyDistancePx(800)).toBe((JOURNEY_VH / 100 - 1) * 800);
  });

  it('treats an unmeasured chapel as no overflow', () => {
    // offsetHeight is 0 before layout and NaN never reaches here, but a
    // track sized to NaN is a blank page -- so both are pinned.
    expect(trackPxWithChapel(800, 0)).toBe(journeyTrackPx(800));
    expect(trackPxWithChapel(800, NaN)).toBe(journeyTrackPx(800));
  });
});
