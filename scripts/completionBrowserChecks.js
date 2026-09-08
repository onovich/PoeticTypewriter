import assert from 'node:assert/strict';

export async function checkCompletion(browser, url) {
  const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 390, height: 844 } });
  let completed = 0;
  const item = () => completed < 10 ? { itemId: `line-${completed}`, text: 'quiet rain' } : null;
  try {
    const page = await context.newPage();
    await page.route('**/v1/challenge/today', route => route.fulfill({ json: {
      playerId: 'completion-player', challengeDate: '2026-09-09', challengeId: 'completion-day',
      completedItems: completed, totalItems: 10, currentItem: item(), stats: { dailyBestCps: 3.25 },
    } }));
    await page.route('**/v1/runs/start', route => route.fulfill({ json: { runToken: 'mock-only' } }));
    await page.route('**/v1/runs/complete', route => {
      completed++;
      return route.fulfill({ json: { validationStatus: 'accepted', recentCps: 3, dailyBestCps: 3.25, nextItem: item() } });
    });
    await page.goto(url);
    for (let index = 0; index < 10; index++) {
      await page.waitForFunction(() => window.__POETIC_TYPEWRITER__?.summary.status === 'awaiting-first-input');
      // The engine's existing inter-sentence transition must finish before typing.
      await page.waitForFunction(() => document.querySelectorAll('.balloon-char').length === 0 && !document.querySelector('#target-poem').classList.contains('fade-out'));
      await page.keyboard.type('quiet rain', { delay: 40 });
      await page.waitForFunction(n => window.__POETIC_TYPEWRITER__.snapshot.completedItems === n, index + 1).catch(async error => {
        console.error('Completion failed', index, await page.evaluate(() => ({ summary: window.__POETIC_TYPEWRITER__.summary,
          text: document.querySelector('#target-poem').textContent, balloons: document.querySelector('#balloons-container').textContent })));
        throw error;
      });
    }
    assert(await page.locator('#challenge-completion').isVisible());
    const average = await page.locator('#completion-average').textContent();
    assert.match(average, /\d+\.\d{2}/);
    assert.match(await page.locator('#completion-best').textContent(), /3\.25/);
    assert.equal(await page.locator('#challenge-stats-panel').isVisible(), false);
    await page.reload();
    await page.waitForSelector('#challenge-completion');
    assert.equal(await page.locator('#completion-average').textContent(), average);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const summary = await page.locator('#challenge-completion').boundingBox();
      const link = await page.locator('.completion-free').boundingBox();
      const keyboard = await page.locator('#typewriter').boundingBox();
      assert(link.y + link.height < keyboard.y);
      assert(summary.x >= 0 && summary.x + summary.width <= width);
      await page.screenshot({ path: `.local/screenshots/completion-${width}.png`, animations: 'disabled' });
    }
    await page.locator('[data-locale="en"]').click();
    await page.waitForFunction(() => document.documentElement.lang === 'en' && !document.querySelector('#app').dataset.transition);
    assert.match(await page.locator('#completion-title').textContent(), /Today/);
    await page.locator('.completion-free').click();
    await page.waitForFunction(() => window.__POETIC_TYPEWRITER__.mode === 'free' && !document.querySelector('#app').dataset.transition);
    assert(await page.locator('#poem-attribution').isVisible());
    assert.equal(await page.locator('#challenge-completion').isVisible(), false);
    await page.setViewportSize({ width: 320, height: 844 });
    const attribution = await page.locator('#poem-attribution').boundingBox();
    const keyboard = await page.locator('#typewriter').boundingBox();
    assert(attribution.y + attribution.height < keyboard.y, 'source credit stays above the keyboard');
    await page.screenshot({ path: '.local/screenshots/classic-poem-320.png', animations: 'disabled' });
    return { tenLines: true, refreshPersists: true, narrowAndDesktop: true, localized: true, freeContinuation: true };
  } finally { await context.close(); }
}
