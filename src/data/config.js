export const KEYBOARD_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

export const GAME_PHASES = {
  TYPING: 'typing',
  WAITING_TO_RISE: 'waiting_to_rise',
  WAITING_TO_RETRACT: 'waiting_to_retract',
  RETRACTING: 'retracting',
  HOVERING: 'hovering',
  BLOWING: 'blowing',
};

export const TIMINGS = {
  admireDelayMs: 1000,
  hoverDelayMs: 1500,
  reloadDelayMs: 3500,
};