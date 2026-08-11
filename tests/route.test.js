import { describe, it, expect, vi } from 'vitest';
import { createRouteState } from '../src/world/route.js';
import { T_FORK_SCROLL } from '../src/world/path.js';

describe('createRouteState', () => {
  it('starts on the direct route, unlocked', () => {
    const r = createRouteState(() => {});
    expect(r.get()).toBe('direct');
    expect(r.isLocked()).toBe(false);
  });
  it('choosing the work route notifies once and sticks', () => {
    const onChange = vi.fn();
    const r = createRouteState(onChange);
    expect(r.choose('work')).toBe(true);
    expect(r.get()).toBe('work');
    expect(onChange).toHaveBeenCalledWith('work');
    expect(onChange).toHaveBeenCalledTimes(1);
  });
  it('choosing the route already active does nothing', () => {
    const onChange = vi.fn();
    const r = createRouteState(onChange);
    expect(r.choose('direct')).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });
  it('ignores unknown routes', () => {
    const r = createRouteState(() => {});
    expect(r.choose('catacombs')).toBe(false);
    expect(r.get()).toBe('direct');
  });
  it('locks once the camera is past the fork', () => {
    const r = createRouteState(() => {});
    r.syncLock(T_FORK_SCROLL + 0.05);
    expect(r.isLocked()).toBe(true);
    expect(r.choose('work')).toBe(false);
    expect(r.get()).toBe('direct');
  });
  it('unlocks again when scrolled back before the fork', () => {
    const onChange = vi.fn();
    const r = createRouteState(onChange);
    r.syncLock(0.8);
    expect(r.isLocked()).toBe(true);
    r.syncLock(0.1);
    expect(r.isLocked()).toBe(false);
    expect(r.choose('work')).toBe(true);
  });
  it('stays unlocked exactly at the fork so the signpost is still usable', () => {
    const r = createRouteState(() => {});
    r.syncLock(T_FORK_SCROLL);
    expect(r.isLocked()).toBe(false);
  });
});
