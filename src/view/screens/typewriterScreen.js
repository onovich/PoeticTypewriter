import { renderKeyboard } from '../components/keyboard.js';

export function renderTypewriterScreen() {
  return `
    <div class="w-full h-screen flex flex-col justify-between">
      <div id="stage" class="relative flex-1 w-full overflow-hidden">
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