import { makeExterior, makeThreshold, makeInterior } from './scenes/placeholders.js';

if (new URLSearchParams(location.search).has('debug')) {
  document.body.style.overflow = 'auto';
  for (const make of [makeExterior, makeThreshold, makeInterior]) {
    const { color, depth } = make();
    for (const c of [color, depth]) {
      c.style.cssText = 'width:320px;height:320px;display:inline-block;margin:4px;position:relative;z-index:10';
      document.body.appendChild(c);
    }
  }
} else {
  console.log('prodfish: boot');
}
