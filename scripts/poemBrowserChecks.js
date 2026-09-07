import assert from 'node:assert/strict';

export async function checkPoemRotation(browser, dailyUrl) {
  const context = await browser.newContext({ locale: 'en-US' });
  const page = await context.newPage();
  const freeUrl = dailyUrl.replace('mode=daily', 'mode=free');
  const freeReady = () => page.waitForFunction(() => window.__POETIC_TYPEWRITER__?.mode === 'free'
    && !document.querySelector('#app').dataset.transition && document.querySelector('#target-poem').textContent.length > 0);
  const poem = () => page.locator('#target-poem').textContent().then(text => text.replace(/\u00a0/g, ' '));
  try {
    await page.goto(freeUrl);
    await freeReady();
    const first = await poem();
    await page.keyboard.type(first, { delay: 5 });
    await page.waitForFunction(previous => document.querySelector('#target-poem').textContent.replace(/\u00a0/g, ' ') !== previous, first);
    const second = await poem();
    assert(second.length > 0);
    await page.reload(); await freeReady();
    const third = await poem();
    await page.locator('[data-mode="daily-challenge"]').click();
    await page.waitForFunction(() => window.__POETIC_TYPEWRITER__.snapshot.totalItems === 10
      && !document.querySelector('#app').dataset.transition);
    assert.equal(await page.locator('#challenge-stats-progress').textContent(), 'Sentence 1 of 10');
    await page.locator('[data-mode="free"]').click(); await freeReady();
    const fourth = await poem();
    assert.equal(new Set([first, second, third, fourth]).size, 4);
    return { dailyCount: 10, freeCompletionAdvances: true, reloadRemembers: true, modeSwitchRemembers: true };
  } finally { await context.close(); }
}
