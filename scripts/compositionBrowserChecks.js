import assert from 'node:assert/strict';
import { POEM_LIBRARY } from '../shared/poemLibrary.js';

export async function checkComposition(browser, url, screenshotDirectory) {
  const text = [...POEM_LIBRARY].sort((a, b) => b.length - a.length)[0];
  for (const [width, height] of [[2304, 1278], [1440, 900], [1024, 768], [390, 844], [320, 740]]) {
    const context = await browser.newContext({ viewport: { width, height }, locale: 'zh-CN' });
    try {
      const page = await context.newPage();
      await page.route('**/v1/challenge/today', route => route.fulfill({ json: {
        challengeId: 'composition-check', totalItems: 10, completedItems: 5,
        currentItem: { itemId: 'long-line', text }, stats: { dailyBestCps: 4.14, dailyRank: 1 },
      } }));
      await page.goto(url);
      await page.waitForFunction(() => window.__POETIC_TYPEWRITER__?.summary.status === 'awaiting-first-input');
      await page.evaluate(() => document.fonts.ready);
      const layout = await page.evaluate(() => {
        const poem = document.querySelector('#target-poem').getBoundingClientRect();
        const body = document.querySelector('#typewriter').getBoundingClientRect();
        const panel = document.querySelector('.challenge-stats-shell').getBoundingClientRect();
        const wordsStayWhole = [...document.querySelectorAll('.poem-word')].every(word => {
          const tops = [...word.children].map(char => char.getBoundingClientRect().top);
          return Math.max(...tops) - Math.min(...tops) < 1;
        });
        const keysInsideBody = [...document.querySelectorAll('.skeuo-key')].every(key => {
          const rect = key.getBoundingClientRect();
          return rect.left >= body.left && rect.right <= body.right;
        });
        return { gap: body.top - poem.bottom, width: body.width, bottom: body.bottom, keysInsideBody,
          panelHeight: panel.height, wordsStayWhole, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert(layout.wordsStayWhole && !layout.overflow, `whole words and no overflow at ${width}`);
      assert(layout.keysInsideBody, `keys stay inside the body at ${width}`);
      assert(layout.gap >= 24 && layout.gap <= 240, `bounded long-verse gap at ${width}: ${layout.gap}`);
      assert(layout.bottom <= height, `keyboard fits at ${width}`);
      if (width >= 1100) {
        assert(layout.width <= 840 && layout.width >= 760, 'bounded desktop body');
        assert(layout.panelHeight <= 40, 'single-line desktop statistics');
      }
      await page.screenshot({ path: `${screenshotDirectory}/composition-${width}.png`, fullPage: true });
    } finally { await context.close(); }
  }
  return { longestLineFits: true, wholeWords: true, boundedDesktopComposition: true };
}
