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

// Whether a panel has content past its scroll cap, and so should show the
// fade that says "there is more below". The tolerance matters: browsers
// routinely report a scrollHeight a pixel or two over the client height for
// content that visually fits, and without it the hint blinks on for panels
// with nothing to scroll.
export function overflows(scrollHeight, clientHeight) {
  if (!clientHeight) return false;
  return scrollHeight - clientHeight > 2;
}

export function createPanels(root, { onChange } = {}) {
  const strip = root.querySelector('.panel-strip');
  const viewport = root.querySelector('.panel-viewport');
  const panels = [...root.querySelectorAll('.panel')];
  const lintel = root.querySelector('.altar-lintel');
  if (!strip || !panels.length) return { go: () => {} };

  let current = 0;

  // One word per panel, cut into the altar face. Built from the panels' own
  // aria-labels so the lintel cannot drift out of step with what it steers.
  const marks = panels.map((panel, i) => {
    const mark = document.createElement('button');
    mark.type = 'button';
    mark.className = 'altar-mark';
    mark.textContent = panel.getAttribute('aria-label') ?? `panel ${i + 1}`;
    mark.addEventListener('click', () => go(i));
    lintel?.append(mark);
    return mark;
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
    marks.forEach((mark, i) => mark.setAttribute('aria-current', i === current ? 'true' : 'false'));
    // The vigil candles are the same state in the 3D scene: whichever word is
    // current, that candle is the lit one. Optional so the no-WebGL and
    // reduced-motion paths, which never build a scene, still page normally.
    onChange?.(current);
    markOverflow();
  }

  // The fade lives on the viewport, but whether it is warranted depends on the
  // panel currently in front of it — the beats panel fits where the ten-row
  // catalog does not. Re-measured on every change of panel and on resize,
  // since both change the answer.
  function markOverflow() {
    if (!viewport) return;
    const panel = panels[current];
    viewport.classList.toggle(
      'has-overflow',
      !!panel && overflows(panel.scrollHeight, panel.clientHeight),
    );
  }

  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') go(current - 1);
    if (e.key === 'ArrowRight') go(current + 1);
  });

  // Swipe. Only horizontal drags are claimed — a vertical one is the
  // visitor scrolling the page, and stealing it would trap them here.
  //
  // The gesture is tracked per pointer id and cleared on pointercancel.
  // Without that, Safari's habit of claiming an ambiguous drag as a page
  // scroll (which fires pointercancel, never pointerup) left startX set
  // forever, so the NEXT unrelated tap measured its dx against a stale
  // origin from a gesture that had already been abandoned — occasionally
  // flipping the panel when someone was only trying to tap a link.
  let startX = null;
  let startY = null;
  let pointerId = null;

  const endGesture = () => {
    startX = null;
    startY = null;
    pointerId = null;
  };

  viewport?.addEventListener('pointerdown', (e) => {
    // A second finger during a drag is a pinch, not a swipe.
    if (pointerId !== null) return endGesture();
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
  });

  viewport?.addEventListener('pointerup', (e) => {
    if (startX === null || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    endGesture();
    if (Math.abs(dx) > Math.abs(dy)) {
      go(panelAfterDrag(current, dx, viewport.clientWidth, panels.length));
    }
  });

  viewport?.addEventListener('pointercancel', endGesture);
  // Dragging out of the carousel entirely is an abandoned gesture too.
  viewport?.addEventListener('pointerleave', endGesture);

  // A rotation or a resized window changes which panels overflow. Passive:
  // this only ever reads layout and toggles a class.
  window.addEventListener('resize', markOverflow, { passive: true });
  // The panel is its own scroll container, so scrolling to the bottom should
  // retire the hint rather than fade a row that is already the last one.
  for (const panel of panels) {
    panel.addEventListener('scroll', () => {
      if (panel !== panels[current]) return;
      const atEnd = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 2;
      viewport?.classList.toggle('at-scroll-end', atEnd);
    }, { passive: true });
  }

  go(0);
  return { go, markOverflow };
}
