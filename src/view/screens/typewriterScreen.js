import { renderKeyboard } from '../components/keyboard.js';
import { renderChallengePanel } from '../components/challengePanel.js';

export function renderTypewriterScreen() {
  return `
    <div class="app-shell w-full h-screen flex flex-col justify-between">
      <header class="app-toolbar">
        <nav class="mode-tabs" aria-label="">
          <a class="mode-tab" data-mode="free" href="?mode=free" data-i18n="free"></a>
          <a class="mode-tab" data-mode="daily-challenge" href="?mode=daily" data-i18n="daily"></a>
        </nav>
        <div class="locale-switch" role="group" aria-label="">
          <button type="button" data-locale="zh-CN" lang="zh-CN">中</button>
          <button type="button" data-locale="en" lang="en">EN</button>
        </div>
      </header>
      <div id="stage" class="relative flex-1 w-full overflow-hidden">
        ${renderChallengePanel()}
        <div class="poem-target-area relative w-full flex justify-center px-4">
          <div id="target-poem" class="target-text flex flex-wrap justify-center"></div>
        </div>
        <svg id="string-canvas" class="absolute inset-0 w-full h-full pointer-events-none z-10"></svg>
        <div id="balloons-container" class="absolute inset-0 w-full h-full pointer-events-none"></div>
      </div>
      <div id="typewriter" class="typewriter-body w-full pb-8 pt-4 px-2 sm:px-4 z-30">
        <div id="paper-slot-area" class="h-2 mx-auto rounded-full paper-slot mb-6 relative"></div>
        <div id="keyboard" class="flex flex-col gap-2 sm:gap-3 max-w-2xl mx-auto">${renderKeyboard()}</div>
      </div>
    </div>`;
}