// app.js
import { loadSettings, applyTheme, initThemeListener } from './settings.js';
import { addEntry, updateEntry, getEntry } from './db.js';

const routes = {
  '/': 'screen-entry',
  '/history': 'screen-history',
  '/import-export': 'screen-import-export',
  '/settings': 'screen-settings',
};

let lastFuelType = 'petrol';

function navigate() {
  const hash = location.hash.slice(1) || '/';
  // Strip query params for route matching
  const path = hash.split('?')[0];
  const screenId = routes[path];

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.bottom-nav a').forEach(a => a.classList.remove('active'));

  if (screenId) {
    document.getElementById(screenId)?.classList.add('active');
  }
  document.querySelector(`.bottom-nav a[href="#${path}"]`)?.classList.add('active');

  // Handle entry screen with edit parameter
  if (path === '/') {
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const editId = params.get('edit');
    if (editId) {
      loadEntryForEdit(editId);
    } else {
      resetEntryForm();
    }
    updateEntryFormLabels();
  }
}

function showToast(message, duration = 2000) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

function toLocalDatetimeValue(date) {
  const d = date || new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function resetEntryForm() {
  const settings = loadSettings();
  document.getElementById('entry-id').value = '';
  document.getElementById('entry-date').value = toLocalDatetimeValue();
  document.getElementById('entry-vehicle').value = settings.defaultVehicle;
  document.getElementById('entry-odometer').value = '';
  document.getElementById('entry-fuel').value = '';
  document.getElementById('entry-cost').value = '';
  document.getElementById('entry-fuel-type').value = lastFuelType;
  document.getElementById('entry-location').value = '';
  document.getElementById('entry-notes').value = '';
}

function updateEntryFormLabels() {
  const settings = loadSettings();
  document.getElementById('entry-fuel-label').textContent = `Fuel (${settings.fuelUnit})`;
  document.getElementById('entry-cost-label').textContent = `Cost (${settings.currency})`;
}

async function loadEntryForEdit(id) {
  const entry = await getEntry(id);
  if (!entry) {
    showToast('Entry not found');
    location.hash = '#/';
    return;
  }
  document.getElementById('entry-id').value = entry.id;
  document.getElementById('entry-date').value = toLocalDatetimeValue(new Date(entry.date));
  document.getElementById('entry-vehicle').value = entry.vehicle || '';
  document.getElementById('entry-odometer').value = entry.odometer;
  document.getElementById('entry-fuel').value = entry.fuelAmount;
  document.getElementById('entry-cost').value = entry.cost;
  document.getElementById('entry-fuel-type').value = entry.fuelType || 'petrol';
  document.getElementById('entry-location').value = entry.location || '';
  document.getElementById('entry-notes').value = entry.notes || '';
}

function setupEntryForm() {
  const form = document.getElementById('entry-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const settings = loadSettings();
    const id = document.getElementById('entry-id').value;
    const data = {
      date: new Date(document.getElementById('entry-date').value).toISOString(),
      vehicle: document.getElementById('entry-vehicle').value.trim(),
      odometer: Number(document.getElementById('entry-odometer').value),
      fuelAmount: Number(document.getElementById('entry-fuel').value),
      fuelUnit: settings.fuelUnit,
      cost: Number(document.getElementById('entry-cost').value),
      currency: settings.currency,
      fuelType: document.getElementById('entry-fuel-type').value,
      location: document.getElementById('entry-location').value.trim(),
      notes: document.getElementById('entry-notes').value.trim(),
    };

    lastFuelType = data.fuelType;

    if (id) {
      await updateEntry({ id, ...data });
      showToast('Entry updated');
      location.hash = '#/history';
    } else {
      await addEntry(data);
      showToast('Entry saved');
      resetEntryForm();
    }
  });
}

// Initialize
function init() {
  const settings = loadSettings();
  applyTheme(settings.darkMode);
  initThemeListener();

  setupEntryForm();

  window.addEventListener('hashchange', navigate);
  navigate();
}

document.addEventListener('DOMContentLoaded', init);

export { showToast, navigate };
