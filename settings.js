// settings.js

const SETTINGS_KEY = 'fuel-log-settings';

const DEFAULTS = {
  defaultVehicle: '',
  fuelUnit: 'litres',
  currency: 'EUR',
  darkMode: 'system',
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function applyTheme(mode) {
  const html = document.documentElement;
  if (mode === 'light' || mode === 'dark') {
    html.setAttribute('data-theme', mode);
  } else {
    // system
    html.removeAttribute('data-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    html.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  }
}

export function initThemeListener() {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { darkMode } = loadSettings();
    if (darkMode === 'system') {
      applyTheme('system');
    }
  });
}
