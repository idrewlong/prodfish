import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// Fraction of the way through a set of downloads, given each file's
// {loaded, total} byte counts. Files whose server sent no Content-Length
// report total 0; they are counted by completion instead of by bytes, so a
// host that omits the header degrades to a coarse bar rather than a stuck one.
export function loadFraction(entries) {
  if (!entries.length) return 0;
  let loaded = 0;
  let total = 0;
  let unsized = 0;
  let unsizedDone = 0;
  for (const e of entries) {
    if (e.total > 0) {
      loaded += Math.min(e.loaded, e.total);
      total += e.total;
    } else {
      unsized += 1;
      if (e.done) unsizedDone += 1;
    }
  }
  const sizedPart = total > 0 ? loaded / total : 0;
  if (total > 0 && unsized === 0) return sizedPart;
  if (total === 0) return unsized ? unsizedDone / unsized : 0;
  // Mixed: weight the two halves by file count, which is the only common
  // currency available when some sizes are unknown.
  const sizedCount = entries.length - unsized;
  return (sizedPart * sizedCount + (unsizedDone / unsized) * unsized) / entries.length;
}

// Wraps a progress callback so the fraction it sees only ever rises. Readings
// from loadFraction can dip -- an unsized file counted by completion learns its
// real Content-Length and is re-weighted by bytes -- and light that recedes
// reads as a fault in a way a hairline sliding back never did.
export function monotonic(report) {
  let peak = 0;
  return (fraction) => {
    if (Number.isFinite(fraction)) {
      peak = Math.max(peak, Math.min(1, Math.max(0, fraction)));
    }
    report(peak);
  };
}

export function createAssetLoader({ onProgress } = {}) {
  const draco = new DRACOLoader();
  draco.setDecoderPath('/draco/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  // The models are ~7MB in total. On a phone that is a long stare at a
  // loading screen with no indication anything is happening, which reads as
  // a hung page rather than a slow one.
  const stats = new Map();
  const report = () => onProgress?.(loadFraction([...stats.values()]));

  function track(url) {
    if (!stats.has(url)) stats.set(url, { loaded: 0, total: 0, done: false });
    return (event) => {
      const s = stats.get(url);
      s.loaded = event.loaded ?? 0;
      s.total = event.total || 0;
      report();
    };
  }

  function finish(url) {
    const s = stats.get(url);
    if (s) {
      s.done = true;
      if (s.total) s.loaded = s.total;
    }
    report();
  }

  return {
    // Optional prop: a missing/broken file logs and returns null — the
    // world renders without it rather than blocking.
    async optional(url) {
      const onFileProgress = track(url);
      try {
        return await loader.loadAsync(url, onFileProgress);
      } catch (e) {
        console.warn(`asset skipped: ${url}`, e);
        return null;
      } finally {
        // A failed file must still count as settled, or the bar sticks
        // just short of full for the whole session.
        finish(url);
      }
    },
    // Required (the chapel): retry, then throw — caller keeps the loading
    // screen up and offers retry.
    async required(url, retries = 2) {
      const onFileProgress = track(url);
      let lastErr;
      for (let i = 0; i <= retries; i++) {
        try {
          const gltf = await loader.loadAsync(url, onFileProgress);
          finish(url);
          return gltf;
        } catch (e) {
          lastErr = e;
        }
      }
      finish(url);
      throw lastErr;
    },
  };
}
