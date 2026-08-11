import { describe, it, expect } from 'vitest';
import { LANDMARKS, positionAt, targetAt, tNearest, T_DOOR, T_GATE, T_ALTAR } from '../src/world/path.js';
import { FORK, routeLength, ROUTES, T_FORK_SCROLL } from '../src/world/path.js';

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

describe('work route', () => {
  it('both routes pass through FORK at their own fork parameter', () => {
    for (const route of ROUTES) {
      const t = tNearest(FORK, route);
      expect(positionAt(t, route).distanceTo(FORK)).toBeLessThan(0.05);
    }
  });
  it('both routes start and end at the same places', () => {
    expect(positionAt(0, 'work').distanceTo(positionAt(0, 'direct'))).toBeLessThan(0.05);
    expect(positionAt(1, 'work').distanceTo(LANDMARKS.ALTAR_STOP)).toBeLessThan(0.05);
  });
  it('the work route is meaningfully longer — it is the scenic one', () => {
    expect(routeLength('work')).toBeGreaterThan(routeLength('direct') * 1.25);
  });
  it('the work route always travels forward (z never doubles back)', () => {
    let prev = positionAt(0, 'work').z;
    for (let t = 0.02; t <= 1.0001; t += 0.02) {
      const z = positionAt(Math.min(t, 1), 'work').z;
      expect(z).toBeLessThanOrEqual(prev + 0.2);
      prev = z;
    }
  });
  it('the work route swings well clear of the direct path (a real detour)', () => {
    let maxX = -Infinity;
    for (let t = 0; t <= 1; t += 0.01) maxX = Math.max(maxX, positionAt(t, 'work').x);
    expect(maxX).toBeGreaterThan(8);
  });
  it('defaults to the direct route when no route is given', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(positionAt(t).distanceTo(positionAt(t, 'direct'))).toBe(0);
      expect(targetAt(t).distanceTo(targetAt(t, 'direct'))).toBe(0);
    }
  });
  it('the work route looks forward, like the direct one', () => {
    for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      expect(targetAt(t, 'work').z).toBeLessThan(positionAt(t, 'work').z);
    }
  });
  it('pins the fork to a scroll fraction inside the approach act', () => {
    expect(T_FORK_SCROLL).toBeGreaterThan(0.15);
    expect(T_FORK_SCROLL).toBeLessThan(0.45);
  });
});
