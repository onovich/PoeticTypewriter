export const APP_MODES = {
  DAILY_CHALLENGE: 'daily-challenge',
  FREE: 'free',
};

export function normalizeAppMode(mode) {
  if (mode === APP_MODES.DAILY_CHALLENGE) {
    return APP_MODES.DAILY_CHALLENGE;
  }

  return APP_MODES.FREE;
}

export function resolveAppMode(searchString = '', fallbackMode = APP_MODES.FREE) {
  const fallback = normalizeAppMode(fallbackMode);
  const params = new URLSearchParams(searchString);
  const rawMode = params.get('mode');

  if (rawMode === 'daily' || rawMode === 'challenge' || rawMode === APP_MODES.DAILY_CHALLENGE) {
    return APP_MODES.DAILY_CHALLENGE;
  }

  if (rawMode === APP_MODES.FREE) {
    return APP_MODES.FREE;
  }

  return fallback;
}