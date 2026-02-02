// app.js
import { loadSettings, applyTheme, initThemeListener } from './settings.js';
import { addEntry, updateEntry, getEntry, getAllEntries, deleteEntries } from './db.js';

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

  // Handle history screen
  if (path === '/history') {
    renderHistory();
  }

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

// ===== History Screen =====
let selectMode = false;

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  }) + ', ' + d.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
  });
}

async function renderHistory() {
  const entries = await getAllEntries();
  const list = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');
  const deleteBtn = document.getElementById('history-delete-btn');
  const settings = loadSettings();

  // Reset select mode
  selectMode = false;
  deleteBtn.style.display = 'none';
  document.getElementById('history-select-btn').textContent = 'Select';

  if (entries.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = entries.map(e => `
    <li class="entry-item" data-id="${e.id}">
      <input type="checkbox" class="history-checkbox" data-id="${e.id}" style="display:none;margin-right:12px;width:20px;height:20px;">
      <div class="entry-item-main">
        <div class="entry-item-date">${formatDate(e.date)}</div>
        <div class="entry-item-details">
          ${e.vehicle ? e.vehicle + ' — ' : ''}${e.fuelAmount} ${e.fuelUnit || settings.fuelUnit} — ${e.currency || settings.currency} ${e.cost.toFixed(2)} — ${e.odometer} km
        </div>
      </div>
    </li>
  `).join('');

  // Tap to edit (on the row, not the checkbox)
  list.querySelectorAll('.entry-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (selectMode) return;
      location.hash = `#/?edit=${item.dataset.id}`;
    });
  });
}

function setupHistory() {
  const selectBtn = document.getElementById('history-select-btn');
  const deleteBtn = document.getElementById('history-delete-btn');

  selectBtn.addEventListener('click', () => {
    selectMode = !selectMode;
    selectBtn.textContent = selectMode ? 'Cancel' : 'Select';
    deleteBtn.style.display = selectMode ? '' : 'none';

    document.querySelectorAll('.history-checkbox').forEach(cb => {
      cb.style.display = selectMode ? '' : 'none';
      cb.checked = false;
    });
  });

  deleteBtn.addEventListener('click', async () => {
    const checked = document.querySelectorAll('.history-checkbox:checked');
    const ids = Array.from(checked).map(cb => cb.dataset.id);
    if (ids.length === 0) {
      showToast('No entries selected');
      return;
    }
    if (!confirm(`Delete ${ids.length} entry(ies)?`)) return;
    await deleteEntries(ids);
    showToast(`Deleted ${ids.length} entry(ies)`);
    renderHistory();
  });
}

// Initialize
function init() {
  const settings = loadSettings();
  applyTheme(settings.darkMode);
  initThemeListener();

  setupEntryForm();
  setupHistory();

  window.addEventListener('hashchange', navigate);
  navigate();
}

document.addEventListener('DOMContentLoaded', init);

export { showToast, navigate };
