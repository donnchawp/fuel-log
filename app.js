// app.js
import { loadSettings, saveSettings, applyTheme, initThemeListener } from './settings.js';
import { addEntry, updateEntry, getEntry, getAllEntries, deleteEntries, estimateStorageUsage } from './db.js';
import { exportJSON, exportCSV, parseJSONImport, parseCSVImport, getExportEntries, importEntries } from './import-export.js';

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

  // Handle settings screen
  if (path === '/settings') {
    loadSettingsScreen();
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

// ===== Import/Export Screen =====
let parsedImportEntries = [];

function setupImportExport() {
  const scopeSelect = document.getElementById('export-scope');
  const dateRangeDiv = document.getElementById('export-date-range');
  const vehicleDiv = document.getElementById('export-vehicle-input');

  scopeSelect.addEventListener('change', () => {
    dateRangeDiv.style.display = scopeSelect.value === 'dateRange' ? '' : 'none';
    vehicleDiv.style.display = scopeSelect.value === 'vehicle' ? '' : 'none';
  });

  // Export button
  document.getElementById('export-btn').addEventListener('click', async () => {
    const format = document.getElementById('export-format').value;
    const scope = scopeSelect.value;
    const opts = {
      vehicle: document.getElementById('export-vehicle').value.trim(),
      startDate: document.getElementById('export-start').value,
      endDate: document.getElementById('export-end').value,
    };

    const entries = await getExportEntries(scope, opts);
    if (entries.length === 0) {
      showToast('No entries to export');
      return;
    }

    if (format === 'json') {
      await exportJSON(entries);
    } else {
      await exportCSV(entries);
    }
    showToast(`Exported ${entries.length} entries`);
  });

  // File input
  const fileInput = document.getElementById('import-file');
  const preview = document.getElementById('import-preview');
  const importBtn = document.getElementById('import-btn');
  const results = document.getElementById('import-results');

  fileInput.addEventListener('change', async () => {
    parsedImportEntries = [];
    preview.style.display = 'none';
    results.style.display = 'none';
    importBtn.disabled = true;

    const file = fileInput.files[0];
    if (!file) return;

    const text = await file.text();
    try {
      if (file.name.endsWith('.json')) {
        parsedImportEntries = parseJSONImport(text);
      } else if (file.name.endsWith('.csv')) {
        parsedImportEntries = parseCSVImport(text);
      } else {
        showToast('Unsupported file type');
        return;
      }

      if (parsedImportEntries.length === 0) {
        preview.textContent = 'No valid entries found in file.';
        preview.style.display = 'block';
        return;
      }

      const dates = parsedImportEntries.map(e => e.date).filter(Boolean).sort();
      const dateRange = dates.length > 0
        ? `${formatDate(dates[0])} to ${formatDate(dates[dates.length - 1])}`
        : 'unknown dates';
      preview.textContent = `Found ${parsedImportEntries.length} entries (${dateRange})`;
      preview.style.display = 'block';
      importBtn.disabled = false;
    } catch (err) {
      preview.textContent = `Error parsing file: ${err.message}`;
      preview.style.display = 'block';
    }
  });

  // Import button
  importBtn.addEventListener('click', async () => {
    if (parsedImportEntries.length === 0) return;
    const overwrite = document.getElementById('import-overwrite').checked;
    const res = await importEntries(parsedImportEntries, overwrite);
    results.textContent = `Added: ${res.added}, Skipped: ${res.skipped}, Overwritten: ${res.overwritten}`;
    results.style.display = 'block';
    showToast(`Imported ${res.added} entries`);
    // Reset
    parsedImportEntries = [];
    fileInput.value = '';
    importBtn.disabled = true;
  });
}

// ===== Settings Screen =====
async function loadSettingsScreen() {
  const settings = loadSettings();
  document.getElementById('setting-vehicle').value = settings.defaultVehicle;
  document.getElementById('setting-unit').value = settings.fuelUnit;
  document.getElementById('setting-currency').value = settings.currency;
  document.getElementById('setting-theme').value = settings.darkMode;

  const usage = await estimateStorageUsage();
  const el = document.getElementById('storage-usage');
  if (usage) {
    const usedKB = (usage.usage / 1024).toFixed(1);
    const quotaMB = (usage.quota / (1024 * 1024)).toFixed(0);
    el.textContent = `Storage: ${usedKB} KB used of ${quotaMB} MB`;
  } else {
    el.textContent = '';
  }
}

function setupSettings() {
  const fields = ['setting-vehicle', 'setting-unit', 'setting-currency', 'setting-theme'];
  const keys = ['defaultVehicle', 'fuelUnit', 'currency', 'darkMode'];

  fields.forEach((fieldId, i) => {
    document.getElementById(fieldId).addEventListener('change', () => {
      const settings = loadSettings();
      settings[keys[i]] = document.getElementById(fieldId).value.trim();
      saveSettings(settings);

      if (keys[i] === 'darkMode') {
        applyTheme(settings.darkMode);
      }
    });
  });
}

// Initialize
function init() {
  const settings = loadSettings();
  applyTheme(settings.darkMode);
  initThemeListener();

  setupEntryForm();
  setupHistory();
  setupImportExport();
  setupSettings();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }

  window.addEventListener('hashchange', navigate);
  navigate();
}

document.addEventListener('DOMContentLoaded', init);

export { showToast, navigate };
