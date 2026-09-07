import assert from 'node:assert/strict';

export async function checkIdleReset(browser, url) {
  // Exercise the real fade timeline in free mode without waiting three minutes.
  const freeContext = await browser.newContext();
  try {
    const freePage = await freeContext.newPage();
    await freePage.addInitScript(() => { const now = Date.now; window.idleOffset = 0; Date.now = () => now() + window.idleOffset; });
    const freeUrl = new URL(url); freeUrl.searchParams.set('mode', 'free');
    await freePage.goto(freeUrl.toString());
    await freePage.waitForSelector('#target-poem .poem-word');
    const verse = await freePage.locator('#target-poem').textContent();
    await freePage.keyboard.type(verse[0]);
    await freePage.evaluate(() => { window.idleOffset = 180001; });
    await freePage.keyboard.type('x');
    await freePage.waitForFunction(() => !document.querySelector('.balloon-char'));
    await freePage.locator('#target-poem').evaluate(element => Promise.all(element.getAnimations().map(a => a.finished)));
    assert.equal(await freePage.locator('#target-poem').textContent(), verse, 'free mode resets without drawing another verse');
    assert.match(await freePage.locator('#challenge-elapsed').textContent(), /^0\.0/);
  } finally { await freeContext.close(); }
  const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1440, height: 900 } });
  let release, starts = 0, submissions = 0;
  const gate = new Promise(resolve => { release = resolve; });
  try {
    const page = await context.newPage();
    await page.clock.install();
    await page.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window);
      window.frameRequests = 0;
      window.requestAnimationFrame = callback => { window.frameRequests++; return raf(callback); };
    });
    await page.route('**/v1/challenge/today', route => route.fulfill({ json: {
      challengeId: 'idle', completedItems: 0, totalItems: 10, currentItem: { itemId: 'one', text: 'quiet rain finds glass' }, stats: { dailyBestCps: 3.2 },
    } }));
    await page.route('**/v1/runs/start', async route => {
      const number = ++starts;
      if (number === 1) await gate;
      await route.fulfill({ json: { runToken: `run-${number}` } });
    });
    await page.route('**/v1/runs/complete', route => { submissions++; return route.abort(); });
    await page.goto(url);
    await page.waitForFunction(() => window.__POETIC_TYPEWRITER__?.summary.status === 'awaiting-first-input');
    await page.keyboard.type('q');
    await page.waitForFunction(() => window.__POETIC_TYPEWRITER__.summary.status === 'starting-run');
    await page.clock.runFor(2000);
    const attachment = await page.evaluate(() => {
      const path = document.querySelector('#string-canvas path');
      const end = path.getPointAtLength(path.getTotalLength());
      const rect = document.querySelector('.balloon-char').getBoundingClientRect();
      const stage = document.querySelector('#stage').getBoundingClientRect();
      return { raisedFromLineBox: stage.top + end.y < rect.bottom - 2, nearGlyph: end.y + stage.top > rect.top + rect.height / 3 };
    });
    assert(attachment.raisedFromLineBox && attachment.nearGlyph, 'string reaches inside line-box whitespace toward glyph');
    await page.clock.fastForward(180001);
    await page.clock.runFor(1000);
    // Playwright's timer clock does not drive the Web Animations timeline.
    await page.evaluate(() => document.getAnimations().forEach(a => a.finish()));
    await page.evaluate(() => document.getAnimations().forEach(a => a.finish()));
    await page.clock.runFor(100);
    await page.waitForFunction(() => document.querySelectorAll('.balloon-char').length === 0, undefined, { polling: 100 });
    assert.equal(await page.locator('.balloon-char').count(), 0);
    assert.equal(await page.locator('#string-canvas path').count(), 0);
    assert.match(await page.locator('#challenge-elapsed').textContent(), /^0\.0/);
    assert.equal(await page.evaluate(() => window.__POETIC_TYPEWRITER__.summary.currentItem), 'quiet rain finds glass');
    const frames = await page.evaluate(() => window.frameRequests);
    await page.clock.runFor(2000);
    assert.equal(await page.evaluate(() => window.frameRequests), frames, 'idle render loop sleeps');
    release();
    await page.clock.runFor(500);
    assert.equal(await page.evaluate(() => window.__POETIC_TYPEWRITER__.snapshot.runToken), null);
    await page.keyboard.type('q');
    await page.waitForFunction(() => window.__POETIC_TYPEWRITER__.snapshot.runToken === 'run-2');
    assert.equal(submissions, 0);
    // Sleep/resume may advance wall time without running the timeout first.
    await page.clock.setSystemTime(new Date(Date.now() + 600000));
    await page.keyboard.type('u');
    await page.clock.runFor(1000);
    // Playwright's timer clock does not drive the Web Animations timeline.
    await page.evaluate(() => document.getAnimations().forEach(a => a.finish()));
    await page.evaluate(() => document.getAnimations().forEach(a => a.finish()));
    await page.clock.runFor(100);
    await page.waitForFunction(() => document.querySelectorAll('.balloon-char').length === 0, undefined, { polling: 100 });
    assert.equal(await page.locator('.balloon-char').count(), 0);
    assert.equal(submissions, 0);
    return { resetsSameQuestion: true, noSubmission: true, staleStartIgnored: true, sleepingFrames: true, attachedStrings: true };
  } finally { release(); await context.close(); }
}
