import assert from 'node:assert/strict';

export async function checkStableStats(browser, url) {
  for (const locale of ['en-US', 'zh-CN']) {
    for (const width of [320, 390, 1440]) {
      const context = await browser.newContext({ locale, viewport: { width, height: 844 } });
      const page = await context.newPage();
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      const item = { itemId: 'one', text: 'quiet rain finds glass' };
      try {
        await page.route('**/v1/challenge/today', route => route.fulfill({ json: {
          challengeId: 'layout-test', totalItems: 10, completedItems: 0, currentItem: item, stats: {},
        } }));
        await page.route('**/v1/runs/start', route => route.fulfill({ json: { runToken: 'layout-only' } }));
        await page.route('**/v1/runs/complete', async route => {
          await gate;
          await route.fulfill({ json: {
            nextItem: { itemId: 'two', text: 'paper birds cross dusk' }, recentCps: 1.21,
            dailyBestCps: 1.21, dailyRank: 12, leaderboardEligible: true, validationStatus: 'accepted', suspiciousFlags: [],
          } });
        });
        await page.goto(url);
        await page.waitForFunction(() => window.__POETIC_TYPEWRITER__?.summary.status === 'awaiting-first-input');
        const geometry = () => page.evaluate(() => ({
          poem: document.querySelector('#target-poem').getBoundingClientRect().top,
          panel: document.querySelector('.challenge-stats-shell').getBoundingClientRect().height,
          keyboard: document.querySelector('#keyboard').getBoundingClientRect().top,
        }));
        const initial = await geometry();
        await page.keyboard.type(item.text, { delay: 5 });
        await page.waitForFunction(() => window.__POETIC_TYPEWRITER__.summary.status === 'submitting');
        assert.equal(await page.locator('#challenge-stats-note').textContent(), '');
        assert.deepEqual(await geometry(), initial, `${locale}/${width}: submitting moves the poem`);
        release();
        await page.waitForFunction(() => window.__POETIC_TYPEWRITER__.summary.validationStatus === 'accepted');
        assert.equal(await page.locator('#challenge-stats-note').textContent(), '');
        assert.match(await page.locator('#challenge-stats-recent').textContent(), /^1\.21/);
        assert.deepEqual(await geometry(), initial, `${locale}/${width}: result moves the poem`);
        // Verify an exceptional message also uses reserved space.
        await page.evaluate(() => {
          const note = document.querySelector('#challenge-stats-note');
          note.textContent = '本次成绩未计入，请重试这一句。 Result not counted. Try this sentence again.';
          note.hidden = false;
        });
        assert.deepEqual(await geometry(), initial, `${locale}/${width}: notice moves the poem`);
      } finally { release(); await context.close(); }
    }
  }
  return { pendingAndAcceptedKeepCoordinates: true, recentScoreInFixedColumn: true, noticeSpaceReserved: true };
}
