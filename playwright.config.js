import { defineConfig } from '@playwright/test';

// The unit suite runs against modules in isolation; everything below needs a
// real browser to mean anything — the chapel variant is chosen by an inline
// <head> script reading a live navigator, the layout claims are about actual
// CSS at actual widths, and the player fallback is driven by an iframe `load`
// event that only exists cross-origin. None of it is reachable from vitest.
export default defineConfig({
  testDir: './tests/e2e',
  // The stalled-player check waits out PLAYER_STALL_MS (8s) for real rather
  // than faking the clock: page.clock would also freeze GSAP's ticker, which
  // the page needs to reach `ready` in the first place.
  timeout: 45_000,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  // `dev` rather than `preview` so a run needs no build step. The inline
  // chapel script and the models it points at are served identically either
  // way; nothing under test is touched by the bundler.
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
