# Immersive layout preview — 2026-09-08

This is a reversible visual experiment, not a production release.

- Branch: `codex/immersive-layout-preview`.
- Baseline: `be0b24b` (includes the SEO center's latest documentation); previous UI commit: `4d94dae`.
- Production remains at Worker version `1f0f4f28-40d6-4ea4-b768-267a990d112a` with the original full-width keyboard.
- Preview: https://poetic-typewriter-staging.onovich1110.workers.dev/PoeticTypewriter/?mode=daily
- Preview Worker version: `db9055a8-3c8a-4488-8825-fd0da8e00077`.

## Experiment

The verse and keyboard now share a vertically centered writing area. Desktop body width is capped at 840px; the stage has a bounded height instead of stretching to fill the window. Desktop statistics occupy one line, with stacked readings on narrower screens. Verse size is 28–32px on desktop and 22–23px on phones. Navigation and language controls align to opposite sides of the same content width. Keyboard borders and rings are simplified.

The original stylesheet remains intact. Experimental styles live in `src/immersive-preview.css`, imported after it. The screen adds a writing-area wrapper; pretext groups letters by word while retaining the original per-character input indexes, so wrapping does not split words. Language fades, mode switching and fixed result positions remain.

## Validation and comparison

Full local browser regression: `.local/layout-preview-smoke-final.log`, including 2304×1278 and existing language, input, timing, result, rotation and SEO checks. The final narrow-screen spacing adjustment is additionally covered by online composition and fixed-position checks in `.local/layout-preview-verification-final.log`.

`scripts/compositionBrowserChecks.js` checks the longest library line at 2304×1278, 1440×900, 1024×768, 390×844 and 320×740: whole words, no horizontal overflow, bounded verse-to-keyboard spacing, keys inside the body, visible keyboard and compact desktop statistics. It is included in the full browser smoke workflow. Screenshots: `.local/screenshots/composition-*.png` and `localized-*-2304.png`. Mocked challenge data is used; no real production scores are submitted.

## Keep or discard

Do not merge this branch into main or deploy it to production until the user accepts the preview. If rejected, main and production already retain the previous interface; no production rollback is necessary. Keep the experimental branch for comparison, or rebuild the baseline in an isolated checkout and redeploy it to staging if the user wants the preview removed. Do not reset or overwrite unrelated SEO work.

If accepted later, merge the complete branch after checking current main, rerun validation, and deploy through the normal staging/production workflow. If subsequently reverted, revert the experiment's commit through a normal new commit; avoid destructive history rewrites. No database migration or production data changes are involved.

## Quiet loading follow-up

Daily bootstrap keeps progress, statistics, notes and verse invisible while reserving their geometry. The loading sentence is removed. Resolved content fades in over 280ms; navigation and keyboard stay visible. Starting a run and submitting a score do not restart this animation. Completed-day content and failure fallback remain available; reduced-motion preferences skip the reveal animation. The stage exposes `aria-busy` during loading.

`scripts/loadingBrowserChecks.js` uses a held API response to verify blank loading, occupied layout, arrival animation, unchanged coordinates, completed days and reduced motion in Chinese and English. Full local regression and the deployed preview both passed: `.local/quiet-loading-smoke.log`, `.local/quiet-loading-verification.log`. This is a follow-up on the same preview branch; main and production remain unchanged.
