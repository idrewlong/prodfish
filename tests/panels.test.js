import { describe, it, expect } from 'vitest';
import { panelIndexFor, panelAfterDrag, overflows } from '../src/panels.js';

describe('panelIndexFor', () => {
  it('clamps rather than wrapping, so the ends feel like ends', () => {
    expect(panelIndexFor(-1, 3)).toBe(0);
    expect(panelIndexFor(3, 3)).toBe(2);
    expect(panelIndexFor(1, 3)).toBe(1);
  });
  it('survives having no panels at all', () => {
    expect(panelIndexFor(2, 0)).toBe(0);
  });
});

describe('panelAfterDrag', () => {
  const W = 800;
  it('advances on a decisive left swipe', () => {
    expect(panelAfterDrag(0, -300, W, 3)).toBe(1);
  });
  it('goes back on a decisive right swipe', () => {
    expect(panelAfterDrag(1, 300, W, 3)).toBe(0);
  });
  it('springs back when the drag is only a nudge', () => {
    // Below a quarter of the viewport reads as an accident, not intent.
    expect(panelAfterDrag(1, -100, W, 3)).toBe(1);
    expect(panelAfterDrag(1, 100, W, 3)).toBe(1);
  });
  it('cannot swipe past either end', () => {
    expect(panelAfterDrag(0, 400, W, 3)).toBe(0);
    expect(panelAfterDrag(2, -400, W, 3)).toBe(2);
  });
});

// The scroll hint at the bottom of the viewport is a dark gradient. Shown
// unconditionally it painted a visible band with a hard edge across every
// panel that fit comfortably — worse than the problem it solves. It is now
// driven by this, so it appears only where content is genuinely cut off.
describe('overflows', () => {
  it('is true when content is taller than the box', () => {
    expect(overflows(1200, 660)).toBe(true);
  });

  it('is false when content fits', () => {
    expect(overflows(400, 660)).toBe(false);
  });

  it('is false when content exactly fills the box', () => {
    expect(overflows(660, 660)).toBe(false);
  });

  it('ignores sub-pixel differences from layout rounding', () => {
    // Browsers routinely report a scrollHeight a fraction taller than the
    // client height on content that visually fits; without a tolerance the
    // hint flickers on for panels with nothing to scroll.
    expect(overflows(660.4, 660)).toBe(false);
    expect(overflows(661, 660)).toBe(false);
    expect(overflows(664, 660)).toBe(true);
  });

  it('is false for an unmeasured element', () => {
    expect(overflows(0, 0)).toBe(false);
  });
});
