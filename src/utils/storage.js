// localStorage keys — kept as constants so a typo won't silently create a second key
const ROUTINES_KEY = 'dance_routines';
const LINEUP_KEY   = 'dance_lineup';
const SETTINGS_KEY = 'dance_settings';

// Each load function falls back to a safe default if localStorage is empty or corrupted

export function loadRoutines() {
  try { return JSON.parse(localStorage.getItem(ROUTINES_KEY)) || []; }
  catch { return []; }
}
export function saveRoutines(routines) {
  localStorage.setItem(ROUTINES_KEY, JSON.stringify(routines));
}

export function loadLineup() {
  try { return JSON.parse(localStorage.getItem(LINEUP_KEY)) || []; }
  catch { return []; }
}
export function saveLineup(lineup) {
  localStorage.setItem(LINEUP_KEY, JSON.stringify(lineup));
}

export function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || defaultSettings();
  } catch { return defaultSettings(); }
}
export function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// Default settings used on first run or if stored settings are unreadable
export function defaultSettings() {
  return { conflictBuffer: 2, numActs: 2, showName: 'Annual Dance Showcase' };
}
