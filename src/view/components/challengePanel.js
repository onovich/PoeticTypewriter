export function renderChallengePanel() {
  return `<div id="challenge-stats-panel" hidden>
    <section class="challenge-stats-shell" aria-label="">
      <div class="challenge-stats-topline">
        <span id="challenge-stats-progress"></span>
        <span class="challenge-rule" aria-hidden="true"></span>
      </div>
      <div class="challenge-stats-grid">
        <div class="challenge-metric challenge-metric-time"><span data-i18n="elapsed"></span><strong id="challenge-elapsed">0.0 s</strong></div>
        <div class="challenge-metric"><span data-i18n="recent"></span><strong id="challenge-stats-recent">--</strong></div>
        <div class="challenge-metric"><span data-i18n="best"></span><strong id="challenge-stats-daily-best">--</strong></div>
        <div class="challenge-metric"><span data-i18n="rank"></span><strong id="challenge-stats-daily-rank">--</strong></div>
      </div>
    </section>
  </div>
  <div class="challenge-notice-slot"><p id="challenge-stats-note" class="challenge-stats-note" role="status" hidden></p></div>`;
}
