import { describe, it, expect } from 'vitest';
import { fitFontPx, ENGRAVED_INK, ENGRAVED_LIT } from '../src/world/engraving.js';

describe('fitFontPx', () => {
  it('never exceeds the base size for short text', () => {
    expect(fitFontPx('the work', 400, 64)).toBe(64);
  });
  it('shrinks long text to fit the board', () => {
    const long = fitFontPx('the work and everything after it', 400, 64);
    expect(long).toBeLessThan(64);
    expect(long).toBeGreaterThan(0);
  });
  it('is monotonic — longer text never gets a bigger size', () => {
    const a = fitFontPx('the work', 400, 64);
    const b = fitFontPx('the work of a lifetime', 400, 64);
    expect(b).toBeLessThanOrEqual(a);
  });
  it('never returns a size so small it would be unreadable', () => {
    expect(fitFontPx('x'.repeat(500), 400, 64)).toBeGreaterThanOrEqual(8);
  });
});

describe('engraving colours', () => {
  it('rests dark and lights warm, so hover reads as a change', () => {
    expect(ENGRAVED_INK).toBeLessThan(ENGRAVED_LIT);
  });
});
