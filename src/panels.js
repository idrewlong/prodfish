// The altar is the destination AND the hub: beats first, with the credits
// and the bio one arrow away rather than a second journey away. Everything
// here is real markup moved by a transform — nothing is created or destroyed
// — so keyboard users, screen readers and search engines get the whole
// catalog and bio without a separate hidden fallback.

export function panelIndexFor(requested, count) {
  if (count <= 0) return 0;
  return Math.min(Math.max(requested, 0), count - 1);
}

// Which panel a horizontal drag should land on: past a quarter of the
// viewport's width counts as a deliberate swipe, anything less springs back.
export function panelAfterDrag(current, dragPx, viewportPx, count) {
  const threshold = viewportPx * 0.25;
  if (dragPx <= -threshold) return panelIndexFor(current + 1, count);
  if (dragPx >= threshold) return panelIndexFor(current - 1, count);
  return current;
}

export function createPanels(root) {
  const strip = root.querySelector('.panel-strip');
  const viewport = root.querySelector('.panel-viewport');
  const panels = [...root.querySelectorAll('.panel')];
  const dotsNav = root.querySelector('.panel-dots');
  const prev = root.querySelector('.panel-prev');
  const next = root.querySelector('.panel-next');
  if (!strip || !panels.length) return { go: () => {} };

  let current = 0;

  const dots = panels.map((panel, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'panel-dot';
    dot.textContent = panel.getAttribute('aria-label') ?? `panel ${i + 1}`;
    dot.addEventListener('click', () => go(i));
    dotsNav?.append(dot);
    return dot;
  });

  function go(requested) {
    current = panelIndexFor(requested, panels.length);
    strip.style.transform = `translateX(${-current * 100}%)`;
    panels.forEach((panel, i) => {
      const active = i === current;
      // Inert panels must leave the tab order, or tabbing walks off-screen
      // through links the visitor cannot see.
      panel.toggleAttribute('inert', !active);
      panel.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
    dots.forEach((dot, i) => dot.setAttribute('aria-current', i === current ? 'true' : 'false'));
    if (prev) prev.disabled = current === 0;
    if (next) next.disabled = current === panels.length - 1;
  }

  prev?.addEventListener('click', () => go(current - 1));
  next?.addEventListener('click', () => go(current + 1));

  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') go(current - 1);
    if (e.key === 'ArrowRight') go(current + 1);
  });

  // Swipe. Only horizontal drags are claimed — a vertical one is the
  // visitor scrolling the page, and stealing it would trap them here.
  let startX = null;
  let startY = null;
  viewport?.addEventListener('pointerdown', (e) => { startX = e.clientX; startY = e.clientY; });
  viewport?.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > Math.abs(dy)) {
      go(panelAfterDrag(current, dx, viewport.clientWidth, panels.length));
    }
    startX = null;
    startY = null;
  });

  go(0);
  return { go };
}
