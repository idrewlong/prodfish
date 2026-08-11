import { describe, it, expect } from 'vitest';
import { pointerToNdc } from '../src/picking.js';

const rect = { left: 100, top: 50, width: 800, height: 400 };

describe('pointerToNdc', () => {
  it('maps the centre of the canvas to the origin', () => {
    expect(pointerToNdc(500, 250, rect)).toEqual({ x: 0, y: 0 });
  });
  it('maps the top-left corner to (-1, 1)', () => {
    expect(pointerToNdc(100, 50, rect)).toEqual({ x: -1, y: 1 });
  });
  it('maps the bottom-right corner to (1, -1)', () => {
    expect(pointerToNdc(900, 450, rect)).toEqual({ x: 1, y: -1 });
  });
  it('accounts for the canvas offset rather than assuming the viewport', () => {
    // Same client point, canvas moved: the NDC must differ.
    const moved = { left: 0, top: 0, width: 800, height: 400 };
    expect(pointerToNdc(500, 250, moved)).not.toEqual(pointerToNdc(500, 250, rect));
  });
});
