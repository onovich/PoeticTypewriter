import { KEYBOARD_ROWS } from '../../data/config.js';

function renderLetterKey(letter) {
  return `<div class="skeuo-key w-8 h-8 sm:w-12 sm:h-12 text-sm sm:text-lg" data-key="${letter}">${letter.toUpperCase()}</div>`;
}

export function renderKeyboard() {
  const rows = KEYBOARD_ROWS.map((row, rowIndex) => {
    if (rowIndex === 0) {
      return `<div class="flex justify-center gap-1 sm:gap-2">${row.map(renderLetterKey).join('')}</div>`;
    }

    if (rowIndex === 1) {
      return `<div class="flex justify-center gap-1 sm:gap-2 ml-4">${row.map(renderLetterKey).join('')}</div>`;
    }

    return `<div class="flex justify-center gap-1 sm:gap-2 pr-4 sm:pr-8">${row.map(renderLetterKey).join('')}<div class="skeuo-key skeuo-key-wide px-3 sm:px-4 h-8 sm:h-12 text-xs sm:text-sm bg-red-900/20" data-key="Backspace">DEL</div></div>`;
  }).join('');

  return `${rows}<div class="flex justify-center mt-2"><div class="skeuo-key skeuo-key-wide w-40 sm:w-64 h-10 sm:h-12" data-key=" "></div></div>`;
}