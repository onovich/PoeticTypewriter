import assert from 'node:assert/strict';

export async function checkLocalScores(browser, url) {
  const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 390, height: 844 } });
  let completed = 0, playerId = 'archive-player', date = '2026-09-08';
  try {
    const page = await context.newPage();
    await page.route('**/v1/challenge/today', route => route.fulfill({ json: {
      playerId, challengeDate: date, challengeId: `archive-${date}`, completedItems: completed, totalItems: 10,
      currentItem: { itemId: completed ? 'two' : 'one', text: completed ? 'paper birds cross dusk' : 'quiet rain finds glass' },
      stats: { dailyBestCps: completed ? 3.2 : 0, dailyRank: completed ? 12 : null },
    } }));
    await page.route('**/v1/runs/start', route => route.fulfill({ json: { runToken: 'local-only' } }));
    await page.route('**/v1/runs/complete', route => {
      completed = 1;
      return route.fulfill({ json: { nextItem: { itemId: 'two', text: 'paper birds cross dusk' },
        recentCps: 2.1, dailyBestCps: 3.2, dailyRank: 12, validationStatus: 'accepted', leaderboardEligible: true } });
    });
    const ready = () => page.waitForFunction(() => window.__POETIC_TYPEWRITER__?.summary.status === 'awaiting-first-input');
    await page.goto(url); await ready();
    await page.keyboard.type('quiet rain finds glass', { delay: 35 });
    await page.waitForFunction(() => window.__POETIC_TYPEWRITER__.snapshot.stats.recentCps === 2.1);
    await page.reload(); await ready();
    assert.match(await page.locator('#challenge-stats-recent').textContent(), /^2\.10/);
    assert.match(await page.locator('#challenge-stats-daily-best').textContent(), /^3\.20/);
    assert.equal(await page.locator('[data-i18n="best"]').textContent(), '我的今日最佳');
    await page.locator('[data-mode="free"]').click();
    await page.waitForFunction(() => window.__POETIC_TYPEWRITER__.mode === 'free' && !document.querySelector('#app').dataset.transition);
    await page.locator('[data-mode="daily-challenge"]').click(); await ready();
    assert.match(await page.locator('#challenge-stats-recent').textContent(), /^2\.10/);
    date = '2026-09-09'; completed = 0;
    await page.reload(); await ready();
    assert.match(await page.locator('#challenge-stats-recent').textContent(), /^--/);
    assert.match(await page.locator('#challenge-stats-daily-best').textContent(), /^--/);
    date = '2026-09-08'; playerId = 'different-player';
    await page.reload(); await ready();
    assert.match(await page.locator('#challenge-stats-recent').textContent(), /^--/);
    const count = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('poetic-typewriter.score-archive.v1')).records).length);
    assert.equal(count, 3, 'prior day and identity records are retained separately');
    return { refreshAndModeSwitch: true, dailyArchive: true, playerIsolation: true };
  } finally { await context.close(); }
}
