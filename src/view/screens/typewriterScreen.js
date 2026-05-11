import { renderKeyboard } from '../components/keyboard.js';

export function renderTypewriterScreen() {
  return `
    <div class="w-full h-screen flex flex-col justify-between">
      <div id="stage" class="relative flex-1 w-full overflow-hidden">
        <div id="challenge-stats-panel" class="absolute left-1/2 top-4 z-30 w-[min(92vw,860px)] -translate-x-1/2 px-2 sm:px-4" hidden>
          <section class="challenge-stats-shell mx-auto">
            <div class="challenge-stats-topline">
              <span id="challenge-stats-mode" class="challenge-stats-pill">Daily Challenge</span>
              <span id="challenge-stats-progress" class="challenge-stats-progress">0/0</span>
              <span id="challenge-stats-status" class="challenge-stats-status">loading</span>
              <span id="challenge-stats-eligibility" class="challenge-stats-eligibility">Checking rank status</span>
            </div>
            <div class="challenge-stats-grid">
              <article class="challenge-stats-card">
                <span class="challenge-stats-label">Recent</span>
                <strong id="challenge-stats-recent" class="challenge-stats-value">--</strong>
              </article>
              <article class="challenge-stats-card">
                <span class="challenge-stats-label">Daily Best</span>
                <strong id="challenge-stats-daily-best" class="challenge-stats-value">--</strong>
              </article>
              <article class="challenge-stats-card">
                <span class="challenge-stats-label">Daily Rank</span>
                <strong id="challenge-stats-daily-rank" class="challenge-stats-value">--</strong>
              </article>
              <article class="challenge-stats-card">
                <span class="challenge-stats-label">All-time Best</span>
                <strong id="challenge-stats-all-time-best" class="challenge-stats-value">--</strong>
              </article>
              <article class="challenge-stats-card">
                <span class="challenge-stats-label">All-time Rank</span>
                <strong id="challenge-stats-all-time-rank" class="challenge-stats-value">--</strong>
              </article>
            </div>
            <div id="challenge-stats-flags" class="challenge-stats-flags" hidden></div>
            <p id="challenge-stats-note" class="challenge-stats-note">Daily stats sync here once the run starts.</p>
          </section>
        </div>
        <div class="absolute top-20 w-full flex justify-center px-4">
          <div id="target-poem" class="target-text flex flex-wrap justify-center"></div>
        </div>
        <svg id="string-canvas" class="absolute inset-0 w-full h-full pointer-events-none z-10"></svg>
        <div id="balloons-container" class="absolute inset-0 w-full h-full pointer-events-none"></div>
      </div>
      <div id="typewriter" class="typewriter-body w-full pb-8 pt-4 px-2 sm:px-4 z-30">
        <div id="paper-slot-area" class="h-2 mx-auto rounded-full paper-slot mb-6 relative"></div>
        <div id="keyboard" class="flex flex-col gap-2 sm:gap-3 max-w-2xl mx-auto">
          ${renderKeyboard()}
        </div>
      </div>
    </div>
  `;
}