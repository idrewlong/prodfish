import { describe, it, expect } from 'vitest';
import { activeStation } from '../src/stations.js';

// Three stations on an 800px viewport, each one screenful apart.
const TOPS = [1000, 1800, 2600];
const V = 800;

describe('activeStation', () => {
  it('reads the first station before the reading line reaches the second', () => {
    // The line sits 40% down the viewport: at scrollY 1000 it is at 1320,
    // which is inside the first station and short of the second.
    expect(activeStation(1000, V, TOPS)).toBe(0);
  });

  it('advances once the reading line crosses a station top', () => {
    // Line at 1800 exactly -- the second station's top.
    expect(activeStation(1480, V, TOPS)).toBe(1);
    expect(activeStation(2280, V, TOPS)).toBe(2);
  });

  it('does not advance a moment early', () => {
    // One pixel short of the second station's top.
    expect(activeStation(1479, V, TOPS)).toBe(0);
  });

  it('stays on the last station at the bottom of the document', () => {
    expect(activeStation(99999, V, TOPS)).toBe(2);
  });

  it('reads the first station above the whole column', () => {
    // Most of the journey happens here: the chapel is far below.
    expect(activeStation(0, V, TOPS)).toBe(0);
  });

  it('survives having no stations at all', () => {
    expect(activeStation(500, V, [])).toBe(0);
  });
});
