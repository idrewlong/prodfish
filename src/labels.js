import * as THREE from 'three';

// Credits are real HTML anchors floated over the 3D scene rather than text
// baked into the stone textures: they stay crisp at any distance, they are
// focusable and clickable, screen readers can read them, and search engines
// can index them. The only cost is projecting a handful of points per frame.

export function labelScreenPosition(ndc, width, height) {
  return {
    x: (ndc.x * 0.5 + 0.5) * width,
    y: (-ndc.y * 0.5 + 0.5) * height,
  };
}

// Fades a label up as its stone comes into reading range and back down as the
// camera slides past, so text never sits jammed against the lens or hovering
// unreadably in the fog.
export function labelOpacity({ ndcZ, distance, nearFade, farFade, enabled = true }) {
  if (!enabled) return 0;                 // gated off (e.g. wrong route)
  if (ndcZ > 1) return 0;                 // behind the camera
  if (distance > farFade) return 0;       // lost in the fog
  if (distance < nearFade * 0.5) return 0; // already passed
  const fadeIn = THREE.MathUtils.clamp((farFade - distance) / (farFade * 0.4), 0, 1);
  const fadeOut = THREE.MathUtils.clamp((distance - nearFade * 0.5) / nearFade, 0, 1);
  return Math.min(fadeIn, fadeOut);
}

export function createLabelLayer({ container, camera }) {
  const items = [];
  const ndc = new THREE.Vector3();

  return {
    // `when` gates a label on something other than geometry — the credit
    // labels use it so they only appear to walkers who actually took the
    // scenic route. Without it they would hang over the graveyard in the
    // middle distance for everyone on the direct path.
    add({ anchor, el, when = () => true }) {
      el.style.position = 'absolute';
      el.style.opacity = '0';
      el.style.visibility = 'hidden';
      container.appendChild(el);
      items.push({ anchor, el, when, lastVisible: false });
    },
    clear() {
      for (const it of items) it.el.remove();
      items.length = 0;
    },
    update() {
      const width = container.clientWidth;
      const height = container.clientHeight;
      for (const it of items) {
        ndc.copy(it.anchor).project(camera);
        const distance = camera.position.distanceTo(it.anchor);
        const opacity = labelOpacity({
          ndcZ: ndc.z, distance, nearFade: 3, farFade: 25, enabled: it.when(),
        });
        const visible = opacity > 0.01;
        if (visible) {
          const { x, y } = labelScreenPosition(ndc, width, height);
          it.el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
          it.el.style.opacity = String(opacity);
        }
        // Toggling visibility (not just opacity) keeps invisible labels out of
        // the tab order and away from the accessibility tree.
        if (visible !== it.lastVisible) {
          it.el.style.visibility = visible ? 'visible' : 'hidden';
          it.el.setAttribute('aria-hidden', visible ? 'false' : 'true');
          it.lastVisible = visible;
        }
      }
    },
  };
}
