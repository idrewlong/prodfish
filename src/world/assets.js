import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export function createAssetLoader() {
  const draco = new DRACOLoader();
  draco.setDecoderPath('/draco/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  return {
    // Optional prop: a missing/broken file logs and returns null — the
    // world renders without it rather than blocking.
    async optional(url) {
      try {
        return await loader.loadAsync(url);
      } catch (e) {
        console.warn(`asset skipped: ${url}`, e);
        return null;
      }
    },
    // Required (the chapel): retry, then throw — caller keeps the loading
    // screen up and offers retry.
    async required(url, retries = 2) {
      let lastErr;
      for (let i = 0; i <= retries; i++) {
        try {
          return await loader.loadAsync(url);
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr;
    },
  };
}
