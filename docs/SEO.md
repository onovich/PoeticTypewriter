# SEO configuration

Canonical site: https://game.onovich.com/PoeticTypewriter/

- The initial HTML contains a descriptive English title, description, canonical URL, Open Graph metadata, a 1200 × 630 PNG preview, Twitter card metadata and factual WebApplication JSON-LD. No invented reviews or ratings.
- Static introductory content and guide links are available before JavaScript runs. The hydrated game retains a semantic heading and a visible localized guide link. Language changes update the title and description without changing the canonical URL.
- Free and daily query variants consolidate to the main game URL. UI localization alone does not create separate indexable game pages: the typing content is still English.
- Build-generated English and Chinese guides have substantial visible localized content, self-canonicals, reciprocal hreflang links and x-default. They work without JavaScript and link back to the game.
- `/PoeticTypewriter/sitemap.xml` lists the game and the two guides. It is linked from HTML and the main page's HTTP Link header. No artificial lastmod dates are emitted.
- Staging assets receive `X-Robots-Tag: noindex`. Production remains indexable. Missing asset URLs must return 404 rather than the game shell.
- The host's root robots.txt and portal belong to the shared game site. This project does not publish an ineffective robots.txt under its subdirectory or take over root routes.

On 2026-09-08, the local SEO center submitted `https://game.onovich.com/PoeticTypewriter/sitemap.xml` in the existing `sc-domain:onovich.com` Google Search Console property. Google reported **Success**, last read 2026-09-08, and **3 discovered pages**. No new account permissions or credentials were needed.

URL Inspection at that time reported the game and English guide as **Discovered - currently not indexed**, with no last crawl. The Chinese guide still reported **URL is unknown to Google**, despite its presence in the successfully processed sitemap. Keep those report observations separate until they update. Indexing requests for the game and Chinese guide were accepted into the priority crawl queue; the English guide was checked and left for sitemap processing. **None of these observations confirms indexing.**

The shared root is a portfolio compatibility entry point; its robots.txt references the portfolio-only `onovich.com` sitemap index. The project sitemap was submitted independently, without changing that index, root routes, or robots.txt. A future game-wide index belongs to the shared root site's maintenance workflow.

The SEO center owns the follow-up record and project-filtered performance analysis. Suggested next review: 2026-09-15, or the next project review, checking sitemap processing, each URL's indexing reason, last crawl and canonical. Read performance with a page filter containing `https://game.onovich.com/PoeticTypewriter/` and record the actual report date range; data predating the SEO release cannot measure its effect. No recurring automation was created in this round.

Submission and confirmed indexing are distinct from code deployment; this repository does not contain Search Console credentials. Monitor actual impressions, queries and clicks before expanding content. Do not generate hundreds of near-identical pages from the poem pool.

Validation: `npm run smoke:cloudflare` includes `scripts/seoBrowserChecks.js` to check the raw/no-JavaScript page, sitemap URLs, reciprocal language annotations, working links, narrow layout, PNG dimensions, staging exclusion and 404 responses, alongside the gameplay regressions. Release also runs the configured build, root and API tests.

References: [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [canonicalization](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions), [Cloudflare asset headers](https://developers.cloudflare.com/workers/static-assets/headers/).
