import { describe, it, expect } from 'vitest';
import { panelIndexFor, panelAfterDrag } from '../src/panels.js';

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
