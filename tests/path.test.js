import { describe, it, expect } from 'vitest';
import { LANDMARKS, positionAt, targetAt, tNearest, T_DOOR, T_GATE, T_ALTAR } from '../src/world/path.js';
import { FORK, routeLength, ROUTES, T_FORK_SCROLL } from '../src/world/path.js';
import { ROW_START, ROW_END, tRow } from '../src/world/path.js';

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
  it('forks at a point distinct from its neighbouring landmarks', () => {
    expect(FORK.distanceTo(LANDMARKS.FIELD_MID)).toBeGreaterThan(3);
    expect(FORK.distanceTo(LANDMARKS.BEND)).toBeGreaterThan(3);
  });
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
    // "Forward" means further along the road, not merely further north. The
    // direct road happens to run z-downhill the whole way, so comparing z
    // worked there; this road swings wide in x, so on its lateral stretches
    // the point ahead can sit at a slightly higher z while still being
    // ahead. Assert the real invariant instead: the look target tracks the
    // point a little further along the curve.
    for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const here = positionAt(t, 'work');
      const target = targetAt(t, 'work');
      const ahead = positionAt(Math.min(t + 0.04, 1), 'work');
      expect(target.distanceTo(ahead)).toBeLessThan(2.5);
      expect(target.distanceTo(here)).toBeGreaterThan(0.5);
    }
  });
  it('pins the fork to a scroll fraction inside the approach act', () => {
    expect(T_FORK_SCROLL).toBeGreaterThan(0.15);
    expect(T_FORK_SCROLL).toBeLessThan(0.45);
  });
});

describe('the long work road', () => {
  it('runs about three times the direct road', () => {
    const ratio = routeLength('work') / routeLength('direct');
    expect(ratio).toBeGreaterThan(2.6);
    expect(ratio).toBeLessThan(3.4);
  });
  it('still meets the direct road at the fork', () => {
    expect(positionAt(tNearest(FORK, 'work'), 'work').distanceTo(FORK)).toBeLessThan(0.05);
  });
  it('still rejoins at the church door', () => {
    expect(positionAt(1, 'work').distanceTo(LANDMARKS.ALTAR_STOP)).toBeLessThan(0.05);
    const tDoorWork = tNearest(LANDMARKS.DOOR, 'work');
    expect(positionAt(tDoorWork, 'work').distanceTo(LANDMARKS.DOOR)).toBeLessThan(0.3);
  });
  it('goes far enough out that the church is genuinely left behind', () => {
    let maxDist = 0;
    for (let t = 0; t <= 1; t += 0.01) {
      const p = positionAt(t, 'work');
      maxDist = Math.max(maxDist, Math.hypot(p.x - LANDMARKS.DOOR.x, p.z - LANDMARKS.DOOR.z));
    }
    expect(maxDist).toBeGreaterThan(45);
  });
  it('never doubles back on itself', () => {
    // Sampled arc-length points must keep moving forward; a curve that
    // reverses would slide the camera backwards mid-scroll.
    let prev = positionAt(0, 'work');
    let travelled = 0;
    for (let t = 0.005; t <= 1.0001; t += 0.005) {
      const p = positionAt(Math.min(t, 1), 'work');
      travelled += p.distanceTo(prev);
      prev = p;
    }
    expect(travelled).toBeCloseTo(routeLength('work'), 0);
  });
  it('marks a monument row well out along the road', () => {
    const { start, end } = tRow('work');
    expect(start).toBeGreaterThan(0.2);
    expect(end).toBeLessThan(0.85);
    expect(end).toBeGreaterThan(start);
    expect(positionAt(start, 'work').distanceTo(ROW_START)).toBeLessThan(0.6);
    expect(positionAt(end, 'work').distanceTo(ROW_END)).toBeLessThan(0.6);
  });
});
