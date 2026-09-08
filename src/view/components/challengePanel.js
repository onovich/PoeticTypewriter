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
  <div class="challenge-notice-slot"><p id="challenge-stats-note" class="challenge-stats-note" role="status" hidden></p></div>
  <section id="challenge-completion" class="challenge-completion" hidden aria-labelledby="completion-title" aria-live="polite">
    <p class="completion-eyebrow" data-i18n="completionEyebrow"></p>
    <h2 id="completion-title" data-i18n="completionTitle"></h2>
    <div class="completion-metrics">
      <div><span data-i18n="completionAverage"></span><strong id="completion-average"></strong></div>
      <div><span data-i18n="completionBest"></span><strong id="completion-best"></strong></div>
    </div>
    <p id="completion-comparison"></p>
    <p class="completion-return" data-i18n="completionReturn"></p>
    <a class="completion-free" href="?mode=free" data-i18n="completionFree"></a>
  </section>`;
}
