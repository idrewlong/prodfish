import { describe, it, expect } from 'vitest';
import { LANDMARKS, positionAt, targetAt, tNearest, T_DOOR, T_GATE, T_ALTAR } from '../src/world/path.js';

describe('path', () => {
  it('starts at START and ends at ALTAR_STOP', () => {
    expect(positionAt(0).distanceTo(LANDMARKS.START)).toBeLessThan(0.01);
    expect(positionAt(1).distanceTo(LANDMARKS.ALTAR_STOP)).toBeLessThan(0.01);
  });
  it('clamps t outside 0..1', () => {
    expect(positionAt(-1).distanceTo(positionAt(0))).toBeLessThan(0.001);
    expect(positionAt(2).distanceTo(positionAt(1))).toBeLessThan(0.001);
  });
  it('z decreases monotonically along the journey (always moving inward)', () => {
    let prev = positionAt(0).z;
    for (let t = 0.05; t <= 1.001; t += 0.05) {
      const z = positionAt(Math.min(t, 1)).z;
      expect(z).toBeLessThanOrEqual(prev + 0.15); // small tolerance for curve wiggle
      prev = z;
    }
  });
  it('T_DOOR passes through the doorway plane', () => {
    const p = positionAt(T_DOOR);
    expect(Math.abs(p.x)).toBeLessThan(0.35);
    expect(Math.abs(p.z)).toBeLessThan(0.35);
  });
  it('landmark ordering: gate before door before altar', () => {
    expect(T_GATE).toBeLessThan(T_DOOR);
    expect(T_DOOR).toBeLessThan(T_ALTAR);
  });
  it('camera always looks forward (target z below position z mid-path)', () => {
    for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      expect(targetAt(t).z).toBeLessThan(positionAt(t).z);
    }
  });
  it('tNearest finds the door', () => {
    expect(Math.abs(tNearest(LANDMARKS.DOOR) - T_DOOR)).toBeLessThan(0.01);
  });
});


