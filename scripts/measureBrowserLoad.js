import { chromium } from 'playwright';

const url = process.argv[2];
if (!url || !['http:', 'https:'].includes(new URL(url).protocol)) {
  throw new Error('Usage: node scripts/measureBrowserLoad.js <daily-challenge-url>');
}
const proxy = process.env.POETIC_TYPEWRITER_TEST_PROXY;
const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  for (const visit of ['cold', 'warm']) {
    // Analytics can delay DOMContentLoaded without delaying the interactive app.
    await page.goto(url, { waitUntil: 'commit' });
    await page.waitForFunction(() => window.__POETIC_TYPEWRITER__?.summary?.status === 'awaiting-first-input');
    const readyMs = await page.evaluate(() => performance.now());
    await page.evaluate(() => document.fonts.ready);
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        ttfbMs: Math.round(navigation.responseStart),
        fontsReadyMs: Math.round(performance.now()),
        assets: performance.getEntriesByType('resource')
          .filter(entry => new URL(entry.name).pathname.includes('/assets/'))
          .map(entry => ({
            file: new URL(entry.name).pathname.split('/').pop(),
            startMs: Math.round(entry.startTime),
            durationMs: Math.round(entry.duration),
            transferredBytes: entry.transferSize,
          })),
      };
    });
    console.log(JSON.stringify({ visit, readyMs: Math.round(readyMs), ...metrics }));
  }
} finally {
  await browser.close();
}
