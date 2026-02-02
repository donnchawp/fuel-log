// app.js
import { loadSettings, applyTheme, initThemeListener } from './settings.js';

const routes = {
  '/': 'screen-entry',
  '/history': 'screen-history',
  '/import-export': 'screen-import-export',
  '/settings': 'screen-settings',
};

function navigate() {
  const hash = location.hash.slice(1) || '/';
  const screenId = routes[hash];

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.bottom-nav a').forEach(a => a.classList.remove('active'));

  if (screenId) {
    document.getElementById(screenId)?.classList.add('active');
  }
  document.querySelector(`.bottom-nav a[href="#${hash}"]`)?.classList.add('active');
}

function showToast(message, duration = 2000) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// Initialize
function init() {
  const settings = loadSettings();
  applyTheme(settings.darkMode);
  initThemeListener();

  window.addEventListener('hashchange', navigate);
  navigate();
}

document.addEventListener('DOMContentLoaded', init);

export { showToast, navigate };
