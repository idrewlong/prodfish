// The chapel is three stations in one column, not a carousel. Everything here
// is real markup in normal flow -- nothing is hidden, transformed off-screen or
// made inert -- so keyboard users, screen readers and crawlers get the whole
// catalog and bio by scrolling, the same way everyone else does.
//
// This module owns only the sticky nav: which link is marked current, and
// (once Lenis exists) turning the anchors into smooth jumps.

// Which station the visitor is reading. The decision is made against a line
// 40% down the viewport rather than its top edge: a station whose heading has
// only just appeared at the very bottom of the screen is not what anyone is
// looking at, and marking it current makes the nav twitch a beat ahead of the
// reader. `tops` are document-space offsets, ascending.
export function activeStation(scrollY, viewportPx, tops) {
  if (!tops.length) return 0;
  const line = scrollY + viewportPx * 0.4;
  let active = 0;
  for (let i = 0; i < tops.length; i++) {
    if (tops[i] <= line) active = i;
  }
  return active;
}

export function createStations(root) {
  const stations = [...root.querySelectorAll('.station')];
  const links = [...root.querySelectorAll('.station-nav a')];
  if (!stations.length || !links.length) return { sync: () => {} };

  function sync() {
    // Measured every time rather than cached: the chapel sits at the bottom of
    // a track whose height is set from JS and re-set on rotation, so a cached
    // offset goes stale on exactly the devices least able to tolerate it.
    const tops = stations.map((s) => s.getBoundingClientRect().top + window.scrollY);
    const i = activeStation(window.scrollY, window.innerHeight, tops);
    links.forEach((link, n) => {
      link.setAttribute('aria-current', n === i ? 'true' : 'false');
    });
  }

  // Passive: this only ever reads layout and sets an attribute.
  window.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', sync, { passive: true });
  sync();
  return { sync };
}

// The nav links are real in-page anchors, so they work with no JS and on the
// static paths where the whole document is laid out in flow. This upgrades
// them to a Lenis jump for the animated path only -- a native anchor jump there
// would teleport the scrubbed camera the length of the journey in one frame,
// which is the same reason wireSkip exists.
export function wireStationLinks(root, lenis) {
  for (const link of root.querySelectorAll('.station-nav a')) {
    link.addEventListener('click', (e) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      // Deliberately NOT stopPropagation: this is a real gesture and letting
      // it reach the window unlocks the ambience, same as any other tap.
      lenis.scrollTo(target, { duration: 1.4, lock: true });
    });
  }
}
