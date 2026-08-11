import { ROUTES, T_FORK_SCROLL } from './path.js';

// Which road we are walking, and whether the choice is still open.
//
// The choice locks once the camera is past the signpost: switching curves
// mid-church would teleport the camera, since the two routes only coincide
// at the fork. Scrolling back up past the signpost re-opens it.
export function createRouteState(onChange) {
  let route = 'direct';
  let locked = false;

  return {
    get: () => route,
    isLocked: () => locked,
    syncLock(scrollFraction) {
      locked = scrollFraction > T_FORK_SCROLL;
    },
    choose(next) {
      if (locked) return false;
      if (!ROUTES.includes(next)) return false;
      if (next === route) return false;
      route = next;
      onChange(route);
      return true;
    },
  };
}
