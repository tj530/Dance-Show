const ROUTINES_KEY = 'dance_routines';
const LINEUP_KEY = 'dance_lineup';
const SETTINGS_KEY = 'dance_settings';

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

export function defaultSettings() {
  return { conflictBuffer: 2, numActs: 2, showName: 'Annual Dance Showcase' };
}
