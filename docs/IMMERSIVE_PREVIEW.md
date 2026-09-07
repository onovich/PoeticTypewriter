# Immersive layout preview — 2026-09-08

The user approved this reversible experiment for production on 2026-09-08. It is now released; the notes below also preserve the preview history.

- Branch: `codex/immersive-layout-preview`.
- Baseline: `be0b24b` (includes the SEO center's latest documentation); previous UI commit: `4d94dae`.
- Production version: `2548f2ee-c271-430f-b088-2e63b2e8e20f` (source `75be88d`). Previous production version, retained for rollback: `1f0f4f28-40d6-4ea4-b768-267a990d112a`.
- Preview: https://poetic-typewriter-staging.onovich1110.workers.dev/PoeticTypewriter/?mode=daily
- Preview Worker version: `a93d3e0f-1a35-4894-bd9c-c1078c39d888`.

## Experiment

The verse and keyboard now share a vertically centered writing area. Desktop body width is capped at 840px; the stage has a bounded height instead of stretching to fill the window. Desktop statistics occupy one line, with stacked readings on narrower screens. Verse size is 28–32px on desktop and 22–23px on phones. Navigation and language controls align to opposite sides of the same content width. Keyboard borders and rings are simplified.

The original stylesheet remains intact. Experimental styles live in `src/immersive-preview.css`, imported after it. The screen adds a writing-area wrapper; pretext groups letters by word while retaining the original per-character input indexes, so wrapping does not split words. Language fades, mode switching and fixed result positions remain.

## Validation and comparison

Full local browser regression: `.local/layout-preview-smoke-final.log`, including 2304×1278 and existing language, input, timing, result, rotation and SEO checks. The final narrow-screen spacing adjustment is additionally covered by online composition and fixed-position checks in `.local/layout-preview-verification-final.log`.

`scripts/compositionBrowserChecks.js` checks the longest library line at 2304×1278, 1440×900, 1024×768, 390×844 and 320×740: whole words, no horizontal overflow, bounded verse-to-keyboard spacing, keys inside the body, visible keyboard and compact desktop statistics. It is included in the full browser smoke workflow. Screenshots: `.local/screenshots/composition-*.png` and `localized-*-2304.png`. Mocked challenge data is used; no real production scores are submitted.

## Keep or discard

The user accepted the preview and requested production deployment. Keep the baseline and experimental branch for comparison. If the user requests rollback, restore the previous release using the normal deployment workflow and revert the three feature commits in reverse order (`75be88d`, `cb23ae1`, `21429ec`) in new Git history. Preserve unrelated SEO work and inspect subsequent changes before reverting.

Avoid destructive history rewrites. No database migration is involved; a rollback does not need to delete local archives or server scores.

## Quiet loading follow-up

Daily bootstrap keeps progress, statistics, notes and verse invisible while reserving their geometry. The loading sentence is removed. Resolved content fades in over 280ms; navigation and keyboard stay visible. Starting a run and submitting a score do not restart this animation. Completed-day content and failure fallback remain available; reduced-motion preferences skip the reveal animation. The stage exposes `aria-busy` during loading.

`scripts/loadingBrowserChecks.js` uses a held API response to verify blank loading, occupied layout, arrival animation, unchanged coordinates, completed days and reduced motion in Chinese and English. Full local regression and the deployed preview both passed: `.local/quiet-loading-smoke.log`, `.local/quiet-loading-verification.log`. This is a follow-up on the same preview branch; main and production remain unchanged.

## Personal daily score archive

The existing backend daily best is the requesting player's validated best; daily rank is that player's position among all players for the challenge. No world-best value is displayed. Labels now say 我的今日最佳 / 我的今日排名 and My best / My rank in the daily panel.

`poetic-typewriter.score-archive.v1` stores one record per server player ID, challenge date and challenge ID, retaining prior dates. Each record contains recent speed, validated personal best, validation status and completed count. Refresh and mode switches restore the latest local result for matching progress. Server best values, including zero, remain authoritative; rankings are not cached. Changed server progress discards a potentially stale recent result. Suspect or rejected result status is retained without promoting its speed into the best. Corrupt or unavailable storage cannot break play; write failures retain current-page memory.

The today API adds the requesting player's opaque `playerId` for cache isolation. It is not an authentication token. Clearing the player cookie results in a separate identity, while clearing local storage removes persistent local history. No login or cross-device local archive is implied. Older recent results not previously cached cannot be reconstructed from this archive; existing server personal bests are saved on the next load. The quiet-loading behavior still waits for the current server response before revealing cached scores.

Validation: root tests cover archive recreation, server corrections, date/player separation, validation status, corrupt storage and quota errors; the real D1/API test verifies another player sees zero personal best despite a scored player existing. Browser tests cover a mocked completed result, reload, mode switching, date change and identity change. Full browser regression and online preview tests pass; the real preview API returns a stable scope ID. Evidence: `.local/local-scores-smoke.log`, `.local/local-scores-validation.log`, `.local/local-scores-verification.log`. No production deployment or real score submission.
