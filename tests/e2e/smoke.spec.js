import { expect, test } from '@playwright/test';

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) '
  + 'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
  + 'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Reduced motion takes bootStatic(), which reaches markReady() without the
// scroll journey — a laid-out page in one navigation instead of a scripted
// scroll whose timing would be the thing under test.
async function settled(page) {
  await page.goto('/');
  await page.waitForSelector('body.ready, body.no-webgl', { timeout: 30_000 });
}

test.describe('chapel variant', () => {
  // church-variant.test.js holds this rule against deviceTier() in a vm
  // sandbox. What it cannot see is a real browser's navigator: this checks
  // the script picks the right file, and preloads the one it picked, from
  // UAs the sandbox can only impersonate.
  for (const [label, ua, touchPoints, expected] of [
    ['an iPhone', IPHONE_UA, 5, '/models/church-mobile.glb'],
    ['an iPad reporting a desktop UA', MAC_UA, 5, '/models/church-mobile.glb'],
    ['a Mac desktop', MAC_UA, 0, '/models/church.glb'],
  ]) {
    test(`sends ${label} the right chapel and preloads it`, async ({ browser }) => {
      const ctx = await browser.newContext({ userAgent: ua, hasTouch: touchPoints > 0 });
      // hasTouch alone reports maxTouchPoints 1, and the tablet rule is
      // `> 1` — a real iPad reports 5. Emulating the count is the whole
      // point of the iPad case, so set it outright.
      await ctx.addInitScript(`Object.defineProperty(navigator, 'maxTouchPoints', { get: () => ${touchPoints} });`);
      const page = await ctx.newPage();
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      expect(await page.evaluate(() => window.__CHURCH__)).toBe(expected);
      // Preloading the file it did not choose is the exact failure this
      // guards: the scene renders correctly either way, silently.
      const hrefs = await page.$$eval(
        'link[rel="preload"][href*="church"]', (ls) => ls.map((l) => new URL(l.href).pathname),
      );
      expect(hrefs).toEqual([expected]);
      await ctx.close();
    });
  }
});

test.describe('layout', () => {
  test.use({ reducedMotion: 'reduce' });
  for (const [label, width, height] of [
    ['iPhone SE', 375, 667],
    ['iPhone 14 Pro', 393, 852],
    ['iPad portrait', 768, 1024],
    ['small laptop', 1280, 800],
    ['desktop', 1440, 900],
    ['wide desktop', 1920, 1080],
  ]) {
    test(`fits at ${label} (${width}x${height})`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await settled(page);
      // Scrollability, not scrollWidth: the off-screen panels are clipped
      // from view, so the only symptom of them extending the scroll area is
      // that the page drags sideways onto blank ground. Nothing else catches
      // that — it looks perfect in a screenshot.
      const dragged = await page.evaluate(() => {
        window.scrollTo(9999, 0);
        const x = window.scrollX;
        window.scrollTo(0, 0);
        return x;
      });
      expect(dragged, 'px the page can be dragged sideways').toBeLessThanOrEqual(1);
      // The inactive panels are parked off to the right on purpose, so their
      // page coordinates prove nothing. What must hold for every one of them
      // is that its own content fits it — a bio or a credit row too wide for
      // its panel is invisible until you page across to it.
      const panels = page.locator('.panel');
      const count = await panels.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const inner = await panels.nth(i).evaluate((el) => el.scrollWidth - el.clientWidth);
        expect(inner, `panel ${i} overflows itself`).toBeLessThanOrEqual(1);
      }
      // The panel actually on screen has to sit inside the viewport.
      const box = await page.locator('.panel:not([aria-hidden="true"])').first().boundingBox();
      expect(box, 'no visible panel').not.toBeNull();
      expect(box.x).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    });
  }
});

test.describe('player fallback', () => {
  test.use({ reducedMotion: 'reduce' });

  test('escalates the wording when the embed never arrives', async ({ page }) => {
    // NOT abort(): Chromium renders an error page for an aborted frame and
    // fires `load` for it, which is the very ambiguity watchPlayer documents.
    // A request that never settles is the only honest "never arrives".
    await page.route('https://player.beatstars.com/**', async () => {
      await new Promise((resolve) => setTimeout(resolve, 60_000));
    });
    await settled(page);
    const shell = page.locator('.altar-frame');
    await expect(shell).toHaveClass(/player-pending/);
    await expect(page.locator('.player-waiting')).toBeVisible();
    await expect(page.locator('.player-late')).toBeHidden();
    // PLAYER_STALL_MS is 8s; the wording swaps without the frame ever loading.
    await expect(shell).toHaveClass(/player-stalled/, { timeout: 20_000 });
    await expect(page.locator('.player-waiting')).toBeHidden();
    await expect(page.locator('.player-late')).toBeVisible();
    // Scoped: .bs-link is also the catalog link in the about panel, which is
    // parked off-screen. The one that carries the weight here is in the beats
    // panel, directly under the frame.
    await expect(page.locator('#panel-beats .bs-link')).toBeVisible();
  });

  test('hands over to the embed once it loads', async ({ page }) => {
    await page.route('https://player.beatstars.com/**', (r) => r.fulfill({
      status: 200, contentType: 'text/html', body: '<!doctype html><title>player</title>',
    }));
    await settled(page);
    const shell = page.locator('.altar-frame');
    // Whatever BeatStars renders is theirs from here — including its own
    // empty state, which is why load is treated as handover, not as success.
    await expect(shell).not.toHaveClass(/player-pending/);
    await expect(shell).not.toHaveClass(/player-stalled/);
    await expect(page.locator('.altar-frame iframe')).toBeVisible();
  });
});

test.describe('ambient sound', () => {
  // The unlock listeners fire on pointerdown from anywhere on the page, and
  // the toggle is itself a pointerdown. One press used to start the ambience
  // on the way down and stop it again on the click, so the control read as
  // dead and the volume row never appeared. Only a browser sees that.
  test('one press turns the sound on and reveals the volume row', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('body.ready', { timeout: 30_000 });
    const button = page.locator('#sound');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#volume-row')).toHaveCSS('opacity', '0');

    await button.click();

    await expect(page.locator('body')).toHaveClass(/sound-on/);
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#volume-row')).toHaveCSS('opacity', '1');
  });

  test('a second press turns it back off', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('body.ready', { timeout: 30_000 });
    const button = page.locator('#sound');
    await button.click();
    await expect(page.locator('body')).toHaveClass(/sound-on/);
    await button.click();
    await expect(page.locator('body')).not.toHaveClass(/sound-on/);
    await expect(button).toHaveAttribute('aria-pressed', 'false');
  });
});
