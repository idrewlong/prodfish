import { defineConfig } from 'vite';

// three's DRACOLoader declares its bundled decoder as three module-level
// `new URL('../libs/draco/…', import.meta.url)` expressions (plus two more in
// its exported DRACO_GLTF_CONFIG). Rollup treats every one of those as an
// asset reference and copies the file into the build — so `dist/` was
// shipping a second, complete copy of the Draco decoder, ~1.3MB of .wasm and
// .js that no code path can ever request.
//
// It cannot request them because createAssetLoader() calls
// setDecoderPath('/draco/') (src/world/assets.js), and setDecoderPath
// overwrites all three entries of `decoderPaths` outright — the module-level
// constants are defaults for a loader that was never configured, and this one
// always is. The bytes were pure deploy weight.
//
// Rewriting the expressions to plain string literals leaves Rollup nothing to
// trace, so the files stop being emitted. The strings still point at the
// copy in public/draco that actually ships, which means the defaults keep
// working if anything ever does fall back to them — this removes a duplicate,
// not a capability.
function dropBundledDraco() {
  const NEW_URL = /new URL\(\s*'\.\.\/libs\/draco\/([^']+)'\s*,\s*import\.meta\.url\s*\)\.toString\(\)/g;
  return {
    name: 'prodfish:drop-bundled-draco',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('DRACOLoader')) return null;
      let hits = 0;
      // `gltf/draco_decoder.wasm` flattens to `draco_decoder.wasm`: public/draco
      // holds the glTF-flavoured decoder already, without the subdirectory.
      const out = code.replace(NEW_URL, (_m, file) => {
        hits += 1;
        return JSON.stringify(`/draco/${file.replace(/^gltf\//, '')}`);
      });
      // A three upgrade that rewrites these expressions would otherwise make
      // this plugin silently do nothing and quietly restore the 1.3MB.
      if (hits === 0) {
        this.warn('DRACOLoader matched no bundled-decoder URLs; the plugin may be stale');
        return null;
      }
      return { code: out, map: null };
    },
  };
}

export default defineConfig({
  plugins: [dropBundledDraco()],
  // vitest globs `tests/` and would otherwise try to collect the Playwright
  // specs, which import a runner it knows nothing about. The two suites are
  // split by extension rather than by directory so a stray file cannot end
  // up in the wrong runner: `*.test.js` is vitest, `*.spec.js` is Playwright.
  test: {
    include: ['tests/**/*.test.js'],
  },
  build: {
    // three is ~600KB of the bundle and changes only when the dependency is
    // upgraded; the site's own code changes constantly. Splitting them means
    // editing the scene ships a small chunk instead of re-invalidating the
    // whole engine in every returning visitor's cache.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('/three/')) return 'three';
          if (id.includes('/gsap/') || id.includes('/lenis/')) return 'motion';
        },
      },
    },
    // The default 4KB inline threshold would base64 small assets into the JS,
    // which for this site means into the chunk that blocks the scene. Assets
    // here are models and images that are better off as separately cached,
    // separately parallelised requests.
    assetsInlineLimit: 0,
    // Every model, texture and decoder in this build is already compressed
    // (Draco, WebP, wasm). Letting the reporter warn about a 600KB three
    // chunk that is deliberately 600KB is noise.
    chunkSizeWarningLimit: 700,
  },
});
