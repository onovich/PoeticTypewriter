import assert from 'node:assert/strict';
import path from 'node:path';

const settled = page => page.waitForFunction(() => !document.querySelector('#app').dataset.transition);
const ready = page => page.waitForFunction(() => window.__POETIC_TYPEWRITER__?.summary?.status === 'awaiting-first-input');

export async function checkLocalizedInterface(browser, url, directory) {
  for (const width of [320, 390, 768, 1024, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'zh-CN' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(url);
      await ready(page);
      assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
      assert.equal(await page.locator('[data-mode="free"]').textContent(), '自由模式');
      assert.equal(await page.locator('.challenge-metric').count(), 3);
      const text = await page.evaluate(() => window.__POETIC_TYPEWRITER__.snapshot.currentItem.text);
      await page.keyboard.type(text[0]);
      await page.waitForFunction(() => parseFloat(document.querySelector('#challenge-elapsed').textContent) >= 0.2);
      const before = await page.locator('#challenge-elapsed').textContent();
      const balloonCount = await page.locator('.balloon-char').count();
      const keyboard = await page.locator('#keyboard').elementHandle();
      const tab = await page.locator('.mode-tabs').elementHandle();
      const deleteWidth = (await page.locator('[data-key="Backspace"]').boundingBox()).width;
      await page.locator('[data-locale="en"]').click();
      assert(await page.locator('.app-toolbar').evaluate(element => element.getAnimations().length > 0), 'language fades adaptive toolbar');
      await settled(page);
      assert.equal(await page.locator('html').getAttribute('lang'), 'en');
      assert.equal(await page.locator('[data-mode="free"]').textContent(), 'Free writing');
      assert.equal(await page.locator('.balloon-char').count(), balloonCount);
      assert.equal((await page.locator('[data-key="Backspace"]').boundingBox()).width, deleteWidth);
      assert(parseFloat(await page.locator('#challenge-elapsed').textContent()) >= parseFloat(before));
      for (const locale of ['en', 'zh-CN']) {
        await page.locator(`[data-locale="${locale}"]`).click();
        await settled(page);
        const layout = await page.evaluate(() => {
          const panel = document.querySelector('.challenge-stats-shell').getBoundingClientRect();
          const poem = document.querySelector('#target-poem').getBoundingClientRect();
          const keyboard = document.querySelector('#keyboard').getBoundingClientRect();
          return { clear: poem.top >= panel.bottom && poem.bottom <= keyboard.top,
            fits: document.documentElement.scrollWidth <= innerWidth && keyboard.left >= 0 && keyboard.right <= innerWidth,
            panelHeight: panel.height };
        });
        assert(layout.clear && layout.fits, `${width}/${locale}: layout ${JSON.stringify(layout)}`);
        assert(layout.panelHeight < 150, 'daily panel stays compact');
        await page.screenshot({ path: path.join(directory, `localized-${locale}-${width}.png`), fullPage: true });
      }
      await page.waitForFunction(() => parseFloat(document.querySelector('#challenge-elapsed').textContent) >= 2);
      assert(await page.evaluate(() => {
        const target = document.querySelector('#target-poem > span').getBoundingClientRect();
        const balloon = document.querySelector('.balloon-char').getBoundingClientRect();
        return Math.abs(target.bottom - balloon.bottom) < 10;
      }), 'typed balloon aligns after translated layout changes');
      // Display populated values without writing a score to any database.
      await page.evaluate(() => {
        const snapshot = window.__POETIC_TYPEWRITER__.snapshot;
        snapshot.stats.dailyBestCps = 88.88;
        snapshot.stats.dailyRank = 123456;
      });
      await page.locator('[data-locale="en"]').click();
      await settled(page);
      assert(await page.locator('#challenge-stats-daily-best').evaluate(element => element.scrollWidth <= element.clientWidth));
      await page.locator('[data-locale="zh-CN"]').click();
      await settled(page);
      await page.locator('[data-mode="free"]').click();
      await page.waitForFunction(() => document.querySelector('#app').dataset.transition === 'mode');
      assert.equal(await keyboard.evaluate(element => element === document.querySelector('#keyboard')), true);
      assert.equal(await tab.evaluate(element => element === document.querySelector('.mode-tabs')), true);
      assert.equal(await keyboard.evaluate(element => getComputedStyle(element).opacity), '1');
      await settled(page);
      assert.equal(new URL(page.url()).searchParams.get('mode'), 'free');
      await page.goBack();
      await settled(page);
      await ready(page);
      assert.equal(await page.locator('#challenge-elapsed').textContent(), '0.0 秒');
      await page.locator('[data-locale="en"]').click();
      await settled(page);
      await page.reload();
      await ready(page);
      assert.equal(await page.locator('html').getAttribute('lang'), 'en', 'manual choice beats Chinese browser after reload');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  // A delayed daily response must not revive the daily UI after leaving it.
  const context = await browser.newContext({ locale: 'en', reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    await page.goto(url.replace('mode=daily', 'mode=free'));
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    let requested;
    const seen = new Promise(resolve => { requested = resolve; });
    await page.route('**/v1/challenge/today', async route => {
      requested(); await gate;
      await route.fulfill({ json: { challengeId: 'old', currentItem: { itemId: 'old', text: 'old response' }, totalItems: 100, completedItems: 0, stats: {} } });
    });
    await page.locator('[data-mode="daily-challenge"]').click();
    await seen; await settled(page);
    await page.locator('[data-mode="free"]').click();
    await settled(page);
    const response = page.waitForResponse('**/v1/challenge/today');
    release(); await response;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(() => window.__POETIC_TYPEWRITER__.summary.mode), 'free');
    assert.equal(await page.locator('#challenge-stats-panel').isVisible(), false);
    await page.locator('[data-locale="zh-CN"]').click();
    await page.locator('[data-locale="en"]').click();
    await settled(page);
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  } finally { await context.close(); }
  return { languages: ['zh-CN', 'en'], widths: [320, 390, 768, 1024, 1440], languagePreservesRun: true, cachedPreference: true, stableKeyboard: true, staleResponseIgnored: true, reducedMotion: true };
}
