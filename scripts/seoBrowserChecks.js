import assert from 'node:assert/strict';
import { site } from './seoPages.js';

export async function checkSeo(browser, base) {
  const origin = new URL(base).origin;
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    const probe = await context.newPage();
    const get = url => probe.goto(url, { waitUntil: 'domcontentloaded' });
    const response = await page.goto(`${origin}/PoeticTypewriter/`);
    assert.equal(response.status(), 200);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), site);
    assert.equal(await page.locator('h1').count(), 1);
    assert.match(await page.locator('main').textContent(), /English typing/);
    const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
    assert.equal(schema['@type'], 'WebApplication');
    const staging = origin.includes('poetic-typewriter-staging.');
    if (staging) assert.match(response.headers()['x-robots-tag'], /noindex/);
    else assert.doesNotMatch(response.headers()['x-robots-tag'] ?? '', /noindex/);
    const sitemapResponse = await get(`${origin}/PoeticTypewriter/sitemap.xml`);
    assert.equal(sitemapResponse.status(), 200);
    const sitemap = await sitemapResponse.text();
    const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
    assert.equal(urls.length, 3);
    for (const canonical of urls.slice(1)) {
      const guideResponse = await page.goto(canonical.replace(new URL(site).origin, origin));
      assert.equal(guideResponse.status(), 200);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), canonical);
      assert.equal(await page.locator('link[hreflang]').count(), 3);
      assert.equal(await page.locator('h1').count(), 1);
      assert.equal(await page.locator('section').count(), 6);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      for (const href of await page.locator('a').evaluateAll(links => links.map(link => link.href))) {
        const linkResponse = await get(href);
        assert.equal(linkResponse.status(), 200, href);
      }
    }
    const preview = await get(`${origin}/PoeticTypewriter/social-preview.png`);
    assert.equal(preview.status(), 200);
    const png = await preview.body();
    assert.equal(png.readUInt32BE(16), 1200);
    assert.equal(png.readUInt32BE(20), 630);
    const missing = await get(`${origin}/PoeticTypewriter/nonexistent-seo-check`);
    assert.equal(missing.status(), 404);
    return { staticContent: true, localizedGuides: true, sitemap: true, socialPreview: true, real404: true };
  } finally { await context.close(); }
}
