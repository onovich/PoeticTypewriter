import assert from 'node:assert/strict';

export async function checkQuietLoading(browser, url) {
  for (const [locale, width, reducedMotion, completed] of [
    ['zh-CN', 390, 'no-preference', false], ['en-US', 2304, 'no-preference', false],
    ['zh-CN', 390, 'reduce', false], ['en-US', 1440, 'no-preference', true],
  ]) {
    const context = await browser.newContext({ locale, reducedMotion, viewport: { width, height: 900 } });
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    try {
      const page = await context.newPage();
      await page.route('**/v1/challenge/today', async route => {
        await gate;
        await route.fulfill({ json: { challengeId: 'quiet-loading', totalItems: 10,
          completedItems: completed ? 10 : 0, currentItem: completed ? null : { itemId: 'one', text: 'quiet rain finds glass' }, stats: {} } });
      });
      await page.route('**/v1/runs/start', route => route.fulfill({ json: { runToken: 'mock-start' } }));
      await page.goto(url);
      await page.waitForFunction(() => document.querySelector('#stage')?.dataset.challengeLoading === 'true');
      assert.equal(await page.locator('#stage').getAttribute('aria-busy'), 'true');
      for (const selector of ['#challenge-stats-panel', '.poem-target-area', '.challenge-notice-slot']) {
        assert.equal(await page.locator(selector).isVisible(), false);
      }
      assert.equal(await page.locator('#challenge-stats-note').textContent(), '');
      assert(await page.locator('.mode-tabs').isVisible());
      assert(await page.locator('#keyboard').isVisible());
      const geometry = () => page.evaluate(() => ['#challenge-stats-panel', '.poem-target-area', '#keyboard']
        .map(selector => document.querySelector(selector).getBoundingClientRect().top));
      const before = await geometry();
      release();
      await page.waitForFunction(() => document.querySelector('#stage').dataset.challengeReady === 'true');
      assert.deepEqual(await geometry(), before, 'arrival keeps reserved coordinates');
      const animation = await page.locator('#challenge-stats-panel').evaluate(element => getComputedStyle(element).animationName);
      assert.equal(animation, reducedMotion === 'reduce' ? 'none' : 'challenge-arrival');
      await page.locator('#stage').evaluate(element => Promise.all(element.getAnimations({ subtree: true }).map(a => a.finished)));
      assert.equal(await page.locator('#challenge-stats-panel').isVisible(), !completed);
      assert.equal(await page.locator('#stage').getAttribute('aria-busy'), 'false');
      if (completed) assert(await page.locator('#challenge-completion').isVisible());
      else {
        await page.keyboard.type('q');
        await page.waitForFunction(() => window.__POETIC_TYPEWRITER__.summary.status === 'ready');
        assert.equal(await page.locator('#challenge-stats-panel').evaluate(element => element.getAnimations().length), 0,
          'starting a run does not replay the loading reveal');
      }
    } finally { release(); await context.close(); }
  }
  return { blankWhileLoading: true, fadesWhenReady: true, stableCoordinates: true, completedAndReducedMotion: true };
}
