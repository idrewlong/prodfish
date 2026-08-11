import { describe, it, expect } from 'vitest';
import { JOURNEY_VH, journeyDistancePx } from '../src/journey.js';

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
