import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { deviceTier, isTouchTablet } from '../src/device.js';

// index.html picks the chapel variant in an inline script rather than
// importing deviceTier(), because a module import would run after parse and
// forfeit the preload head start that is the whole reason the choice is made
// in <head> at all. That leaves the predicate written out twice.
//
// So this suite does not test a copy of the rule — it extracts the real
// script out of the real index.html, runs it, and holds it against
// deviceTier() on identical inputs. If someone edits one and not the other,
// the case where they disagree fails here.

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'index.html'), 'utf8');

function extractChurchScript(source) {
  // The one inline <script> that has no src and assigns __CHURCH__.
  const scripts = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const found = scripts.filter((s) => s.includes('__CHURCH__'));
  if (found.length !== 1) {
    throw new Error(`expected exactly one inline __CHURCH__ script, found ${found.length}`);
  }
  return found[0];
}

// Runs the extracted script in a sandbox with a stubbed navigator, and
// returns both the URL it chose and the href of the preload link it appended.
// Both matter: choosing the right file but hinting the other one is the exact
// failure the script exists to prevent.
function runScript(navigatorStub) {
  const appended = [];
  const sandbox = {
    navigator: navigatorStub,
    document: {
      head: { appendChild: (node) => appended.push(node) },
      createElement: () => ({}),
    },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(extractChurchScript(html), sandbox);
  return { url: sandbox.window.__CHURCH__, preloaded: appended.map((l) => l.href) };
}

const MOBILE = '/models/church-mobile.glb';
const DESKTOP = '/models/church.glb';

// Every meaningfully different navigator the rule can see. `undefined` for
// deviceMemory/hardwareConcurrency is not padding: Safari ships neither, so
// the absent case is what most iPhones and Macs actually hit.
const CASES = [
  ['iPhone', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', maxTouchPoints: 5 }],
  ['Android phone', { userAgent: 'Mozilla/5.0 (Linux; Android 14) Mobile', maxTouchPoints: 5, deviceMemory: 8, hardwareConcurrency: 8 }],
  ['iPad (desktop UA)', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 }],
  ['Mac desktop', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 0, deviceMemory: 8, hardwareConcurrency: 10 }],
  ['Windows desktop', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', maxTouchPoints: 0, deviceMemory: 8, hardwareConcurrency: 16 }],
  ['low-memory laptop', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', maxTouchPoints: 0, deviceMemory: 4, hardwareConcurrency: 8 }],
  ['few-core laptop', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', maxTouchPoints: 0, deviceMemory: 8, hardwareConcurrency: 4 }],
  ['Safari, no hints', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 0 }],
];

describe('the chapel variant chosen in index.html', () => {
  it.each(CASES)('agrees with deviceTier() on %s', (_label, nav) => {
    const tier = deviceTier({
      isMobileUA: /Mobi|Android|iPhone|iPad/i.test(nav.userAgent)
        || isTouchTablet({ userAgent: nav.userAgent, maxTouchPoints: nav.maxTouchPoints }),
      memory: nav.deviceMemory,
      cores: nav.hardwareConcurrency,
    });
    expect(runScript(nav).url).toBe(tier === 'low' ? MOBILE : DESKTOP);
  });

  it.each(CASES)('preloads exactly the file it will fetch on %s', (_label, nav) => {
    const { url, preloaded } = runScript(nav);
    expect(preloaded).toEqual([url]);
  });

  it('sends phones the mobile cut and desktops the full one', () => {
    expect(runScript(CASES[0][1]).url).toBe(MOBILE);
    expect(runScript(CASES[4][1]).url).toBe(DESKTOP);
  });

  it('no longer carries a hardcoded chapel preload tag', () => {
    // A leftover static <link rel=preload href=/models/church.glb> would sit
    // alongside the injected one and pull 4.2MB onto every phone — silently,
    // since the scene would still render correctly off the mobile file.
    expect(html).not.toMatch(/<link[^>]+rel="preload"[^>]+church/);
  });
});
