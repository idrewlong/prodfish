import * as THREE from 'three';

const loader = new THREE.TextureLoader();

function tryLoad(url) {
  return new Promise((resolve) => {
    loader.load(url, (tex) => resolve(tex), undefined, () => resolve(null));
  });
}

// Tries real images in /public/scenes; any missing file falls back to
// the procedural placeholder so partial drops still work.
export async function loadSceneTextures(name, makePlaceholder) {
  const [color, depth] = await Promise.all([
    tryLoad(`/scenes/${name}.jpg`),
    tryLoad(`/scenes/${name}-depth.jpg`),
  ]);
  let placeholder = null;
  const getPlaceholder = () => (placeholder ??= makePlaceholder());
  return {
    colorTex: color ?? new THREE.CanvasTexture(getPlaceholder().color),
    depthTex: depth ?? new THREE.CanvasTexture(getPlaceholder().depth),
  };
}
