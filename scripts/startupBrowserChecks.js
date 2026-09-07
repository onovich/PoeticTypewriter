import assert from 'node:assert/strict';

export async function checkQuietStartup(browser, url) {
  const context = await browser.newContext();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  try {
    const page = await context.newPage();
    await page.route('**/*', async route => {
      if (['script', 'stylesheet'].includes(route.request().resourceType())) await gate;
      await route.continue();
    });
    await page.goto(url, { waitUntil: 'commit' });
    await page.locator('#app').waitFor({ state: 'attached' });
    assert.equal(await page.locator('body').innerText(), '', 'no intro flash while JS and CSS are delayed');
    assert.equal(await page.locator('html').evaluate(e => getComputedStyle(e).backgroundColor), 'rgb(26, 26, 26)');
    release();
    await page.waitForSelector('.app-toolbar');
    assert.equal(await page.locator('body').getByText('Free English typing practice with short poetic lines and a vintage typewriter.', { exact: true }).count(), 0);
    return { blankBeforeScripts: true, darkBeforeStyles: true, gameMounts: true };
  } finally { release(); await context.close(); }
}
