// app.js
import { loadSettings, saveSettings, applyTheme, initThemeListener } from './settings.js';
import { addEntry, updateEntry, getEntry, getAllEntries, deleteEntries, estimateStorageUsage, getDistinctVehicles } from './db.js';
import { exportJSON, exportCSV, parseJSONImport, parseCSVImport, getExportEntries, importEntries } from './import-export.js';

const routes = {
  '/': 'screen-entry',
  '/history': 'screen-history',
  '/stats': 'screen-stats',
  '/import-export': 'screen-import-export',
  '/charts': 'screen-charts',
  '/settings': 'screen-settings',
};

let lastFuelType = 'petrol';

function navigate() {
  const hash = location.hash.slice(1) || '/';
  // Strip query params for route matching
  const path = hash.split('?')[0];
  const screenId = routes[path];

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.bottom-nav a').forEach(a => {
    a.classList.remove('active');
    a.removeAttribute('aria-current');
  });

  if (screenId) {
    document.getElementById(screenId)?.classList.add('active');
  }
  const activeLink = document.querySelector(`.bottom-nav a[href="#${path}"]`);
  if (activeLink) {
    activeLink.classList.add('active');
    activeLink.setAttribute('aria-current', 'page');
  }

  // Handle history screen
  if (path === '/history') {
    renderHistory();
  }

  // Handle settings screen
  if (path === '/settings') {
    loadSettingsScreen();
  }

  // Handle stats screen
  if (path === '/stats') {
    renderStats();
  }

  // Handle charts screen
  if (path === '/charts') {
    renderCharts();
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
  document.getElementById('entry-ppl').value = '';
  document.getElementById('entry-cost').value = '';
  document.getElementById('entry-fuel-type').value = lastFuelType;
  document.getElementById('entry-partial').checked = false;
  document.getElementById('entry-location').value = '';
  document.getElementById('entry-notes').value = '';
}

function updateEntryFormLabels() {
  const settings = loadSettings();
  document.getElementById('entry-fuel-label').textContent = `Fuel (${settings.fuelUnit})`;
  const unitSingular = settings.fuelUnit === 'litres' ? 'litre' : 'gallon';
  document.getElementById('entry-ppl-label').textContent = `Cost/${unitSingular} (${settings.currency})`;
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
  document.getElementById('entry-ppl').value = entry.fuelAmount ? (entry.cost / entry.fuelAmount).toFixed(3) : '';
  document.getElementById('entry-cost').value = entry.cost;
  document.getElementById('entry-fuel-type').value = entry.fuelType || 'petrol';
  document.getElementById('entry-partial').checked = !!entry.partialFill;
  document.getElementById('entry-location').value = entry.location || '';
  document.getElementById('entry-notes').value = entry.notes || '';
}

function setupEntryForm() {
  const fuelEl = document.getElementById('entry-fuel');
  const pplEl = document.getElementById('entry-ppl');
  const costEl = document.getElementById('entry-cost');

  // Fuel changed: if cost/litre is set, calculate total cost
  fuelEl.addEventListener('input', () => {
    const fuel = Number(fuelEl.value);
    const ppl = Number(pplEl.value);
    if (fuel && ppl) {
      costEl.value = (fuel * ppl).toFixed(2);
    }
  });

  // Cost/litre changed: if fuel is set, calculate total cost;
  // if only total cost is set, calculate fuel
  pplEl.addEventListener('input', () => {
    const ppl = Number(pplEl.value);
    const fuel = Number(fuelEl.value);
    const cost = Number(costEl.value);
    if (ppl && fuel) {
      costEl.value = (fuel * ppl).toFixed(2);
    } else if (ppl && cost) {
      fuelEl.value = (cost / ppl).toFixed(2);
    }
  });

  // Cost changed: if cost/litre is set, calculate fuel
  costEl.addEventListener('input', () => {
    const cost = Number(costEl.value);
    const ppl = Number(pplEl.value);
    if (cost && ppl) {
      fuelEl.value = (cost / ppl).toFixed(2);
    }
  });

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
      partialFill: document.getElementById('entry-partial').checked,
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

// ===== Stats Screen =====

function formatDuration(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  const parts = [];
  if (years > 0) parts.push(`${years} year${years !== 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} month${months !== 1 ? 's' : ''}`);
  if (days > 0 || parts.length === 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  return parts.join(', ');
}

function computeConsumptionSegments(entries) {
  // entries must be sorted by date ASC, same vehicle
  if (entries.length < 2) return [];

  const segments = [];
  let accumulatedFuel = 0;
  let lastFullFillIndex = 0;

  for (let i = 1; i < entries.length; i++) {
    accumulatedFuel += entries[i].fuelAmount;
    if (entries[i].partialFill) continue;

    // Full fill — compute from last full fill
    const distance = entries[i].odometer - entries[lastFullFillIndex].odometer;
    if (distance > 0) {
      segments.push({ fuel: accumulatedFuel, distance });
    }
    accumulatedFuel = 0;
    lastFullFillIndex = i;
  }
  return segments;
}

function fmt(value, decimals = 2) {
  if (value == null || !isFinite(value)) return '—';
  return value.toFixed(decimals);
}

async function renderStats() {
  const settings = loadSettings();
  const allEntries = await getAllEntries(); // newest first
  const vehicles = await getDistinctVehicles();
  const vehicleSelect = document.getElementById('stats-vehicle');
  const content = document.getElementById('stats-content');
  const empty = document.getElementById('stats-empty');

  // Populate vehicle filter (preserve selection)
  const currentVal = vehicleSelect.value;
  vehicleSelect.innerHTML = '<option value="all">All vehicles</option>' +
    vehicles.map(v => `<option value="${v}">${v}</option>`).join('');
  if (vehicles.includes(currentVal)) vehicleSelect.value = currentVal;

  // Filter entries
  let entries = [...allEntries].reverse(); // oldest first
  const selectedVehicle = vehicleSelect.value;
  if (selectedVehicle !== 'all') {
    entries = entries.filter(e => e.vehicle === selectedVehicle);
  }

  if (entries.length === 0) {
    content.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  // Sort by date ASC (already reversed above), then by odometer for ties
  entries.sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    return d !== 0 ? d : a.odometer - b.odometer;
  });

  const unitLabel = settings.fuelUnit === 'litres' ? 'L' : 'gal';
  const unitPer100 = settings.fuelUnit === 'litres' ? 'L/100km' : 'gal/100km';
  const cur = settings.currency;

  // Basic aggregates
  const totalCost = entries.reduce((s, e) => s + (e.cost || 0), 0);
  const totalFuel = entries.reduce((s, e) => s + (e.fuelAmount || 0), 0);
  const minOdo = entries[0].odometer;
  const maxOdo = entries[entries.length - 1].odometer;
  const totalDistance = maxOdo - minOdo;
  const firstDate = new Date(entries[0].date);
  const lastDate = new Date(entries[entries.length - 1].date);
  const totalDays = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));
  const totalTimeStr = entries.length > 1 ? formatDuration(entries[0].date, entries[entries.length - 1].date) : '—';

  // Consumption segments
  const segments = computeConsumptionSegments(entries);
  const consumptions = segments.map(s => (s.fuel / s.distance) * 100);
  const avgConsumption = consumptions.length > 0 ? consumptions.reduce((a, b) => a + b, 0) / consumptions.length : null;
  const minConsumption = consumptions.length > 0 ? Math.min(...consumptions) : null;
  const maxConsumption = consumptions.length > 0 ? Math.max(...consumptions) : null;
  const lastConsumption = consumptions.length > 0 ? consumptions[consumptions.length - 1] : null;

  // Cost per unit of fuel
  const costPerUnits = entries.filter(e => e.fuelAmount > 0).map(e => e.cost / e.fuelAmount);
  const avgCostPerUnit = costPerUnits.length > 0 ? costPerUnits.reduce((a, b) => a + b, 0) / costPerUnits.length : null;
  const minCostPerUnit = costPerUnits.length > 0 ? Math.min(...costPerUnits) : null;
  const maxCostPerUnit = costPerUnits.length > 0 ? Math.max(...costPerUnits) : null;
  const lastCostPerUnit = costPerUnits.length > 0 ? costPerUnits[costPerUnits.length - 1] : null;

  // Derived stats
  const costPerKm = totalDistance > 0 ? totalCost / totalDistance : null;
  const costPerFuelup = entries.length > 0 ? totalCost / entries.length : null;
  const costPerDay = totalDays > 0 ? totalCost / totalDays : null;
  const distPerDay = totalDays > 0 ? totalDistance / totalDays : null;
  const fuelPerFuelup = entries.length > 0 ? totalFuel / entries.length : null;
  const daysPerFuelup = entries.length > 1 ? totalDays / (entries.length - 1) : null;
  const kmPerFuelup = entries.length > 1 ? totalDistance / (entries.length - 1) : null;
  const fuelPerDay = totalDays > 0 ? totalFuel / totalDays : null;
  const kmPerCost = totalCost > 0 ? totalDistance / totalCost : null;

  const n = entries.length;

  let html = '';

  // Section 1: Running Costs
  html += `<div class="stats-section">
    <h2>Running Costs</h2>
    <div class="stat-row"><span class="stat-label">Total fuel cost</span><span class="stat-value">${cur} ${fmt(totalCost)}</span></div>
    <div class="stat-row"><span class="stat-label">Cost/day</span><span class="stat-value">${cur} ${fmt(costPerDay)}</span></div>
    <div class="stat-row"><span class="stat-label">Cost/km</span><span class="stat-value">${cur} ${fmt(costPerKm, 3)}</span></div>
    <div class="stat-row"><span class="stat-label">Distance/day</span><span class="stat-value">${fmt(distPerDay, 1)} km</span></div>
  </div>`;

  // Section 2: Distance & Time
  html += `<div class="stats-section">
    <h2>Distance &amp; Time</h2>
    <div class="stat-row"><span class="stat-label">Total distance</span><span class="stat-value">${totalDistance.toLocaleString()} km</span></div>
    <div class="stat-row"><span class="stat-label">Total time</span><span class="stat-value">${totalTimeStr}</span></div>
  </div>`;

  // Section 3: Fuel-Ups
  html += `<div class="stats-section">
    <h2>Fuel-Ups (${n})</h2>
    <div class="stat-grid">
      <div class="stat-pair"><div class="stat-row"><span class="stat-label">Avg ${unitPer100}</span><span class="stat-value">${fmt(avgConsumption)}</span></div><div class="stat-row"><span class="stat-label">Last ${unitPer100}</span><span class="stat-value">${fmt(lastConsumption)}</span></div></div>
      <div class="stat-pair"><div class="stat-row"><span class="stat-label">Min ${unitPer100}</span><span class="stat-value">${fmt(minConsumption)}</span></div><div class="stat-row"><span class="stat-label">Max ${unitPer100}</span><span class="stat-value">${fmt(maxConsumption)}</span></div></div>
      <div class="stat-pair"><div class="stat-row"><span class="stat-label">Avg cost/${unitLabel}</span><span class="stat-value">${cur} ${fmt(avgCostPerUnit, 3)}</span></div><div class="stat-row"><span class="stat-label">Last cost/${unitLabel}</span><span class="stat-value">${cur} ${fmt(lastCostPerUnit, 3)}</span></div></div>
      <div class="stat-pair"><div class="stat-row"><span class="stat-label">Min cost/${unitLabel}</span><span class="stat-value">${cur} ${fmt(minCostPerUnit, 3)}</span></div><div class="stat-row"><span class="stat-label">Max cost/${unitLabel}</span><span class="stat-value">${cur} ${fmt(maxCostPerUnit, 3)}</span></div></div>
      <div class="stat-pair"><div class="stat-row"><span class="stat-label">Cost/km</span><span class="stat-value">${cur} ${fmt(costPerKm, 3)}</span></div><div class="stat-row"><span class="stat-label">Cost/fuelup</span><span class="stat-value">${cur} ${fmt(costPerFuelup)}</span></div></div>
      <div class="stat-pair"><div class="stat-row"><span class="stat-label">Cost/day</span><span class="stat-value">${cur} ${fmt(costPerDay)}</span></div><div class="stat-row"><span class="stat-label">Km/${cur}</span><span class="stat-value">${fmt(kmPerCost, 1)}</span></div></div>
      <div class="stat-pair"><div class="stat-row"><span class="stat-label">${unitLabel}/fuelup</span><span class="stat-value">${fmt(fuelPerFuelup, 1)}</span></div><div class="stat-row"><span class="stat-label">Days/fuelup</span><span class="stat-value">${fmt(daysPerFuelup, 1)}</span></div></div>
      <div class="stat-pair"><div class="stat-row"><span class="stat-label">Km/fuelup</span><span class="stat-value">${fmt(kmPerFuelup, 1)}</span></div><div class="stat-row"><span class="stat-label">${unitLabel}/day</span><span class="stat-value">${fmt(fuelPerDay, 2)}</span></div></div>
      <div class="stat-pair"><div class="stat-row"><span class="stat-label">Total cost</span><span class="stat-value">${cur} ${fmt(totalCost)}</span></div><div class="stat-row"><span class="stat-label">Total ${unitLabel}</span><span class="stat-value">${fmt(totalFuel, 1)}</span></div></div>
    </div>
  </div>`;

  content.innerHTML = html;
}

function setupStats() {
  document.getElementById('stats-vehicle').addEventListener('change', () => {
    renderStats();
  });
}

// ===== Charts Screen =====
const MS_PER_DAY = 1000 * 60 * 60 * 24;
let thumbCharts = [];
let modalChart = null;

const CHART_DEFS = [
  {
    id: 'pricePerL',
    title: 'Price / L',
    yLabel: 'Cost/L',
    compute(entries) {
      return entries
        .filter(e => e.fuelAmount > 0)
        .map(e => ({ x: e.date, y: e.cost / e.fuelAmount }));
    },
  },
  {
    id: 'lPer100km',
    title: 'L/100km',
    yLabel: 'L/100km',
    compute(entries) {
      const segments = computeConsumptionSegments(entries);
      if (segments.length === 0) return [];
      // Map segments back to dates: each segment ends at a full fill
      const points = [];
      let segIdx = 0;
      let lastFullFillIndex = 0;
      for (let i = 1; i < entries.length && segIdx < segments.length; i++) {
        if (entries[i].partialFill) continue;
        const distance = entries[i].odometer - entries[lastFullFillIndex].odometer;
        if (distance > 0) {
          points.push({ x: entries[i].date, y: (segments[segIdx].fuel / segments[segIdx].distance) * 100 });
          segIdx++;
        }
        lastFullFillIndex = i;
      }
      return points;
    },
  },
  {
    id: 'fuelCosts',
    title: 'Fuel Costs',
    yLabel: 'Cost',
    compute(entries) {
      return entries.map(e => ({ x: e.date, y: e.cost }));
    },
  },
  {
    id: 'lPerFuelup',
    title: 'L / FuelUp',
    yLabel: 'Litres',
    compute(entries) {
      return entries.map(e => ({ x: e.date, y: e.fuelAmount }));
    },
  },
  {
    id: 'kmBetween',
    title: 'Km btwn FuelUps',
    yLabel: 'km',
    compute(entries) {
      const points = [];
      for (let i = 1; i < entries.length; i++) {
        const km = entries[i].odometer - entries[i - 1].odometer;
        if (km > 0) points.push({ x: entries[i].date, y: km });
      }
      return points;
    },
  },
  {
    id: 'daysBetween',
    title: 'Time btwn FuelUps',
    yLabel: 'Days',
    compute(entries) {
      const points = [];
      for (let i = 1; i < entries.length; i++) {
        const days = (new Date(entries[i].date) - new Date(entries[i - 1].date)) / MS_PER_DAY;
        points.push({ x: entries[i].date, y: Math.round(days * 10) / 10 });
      }
      return points;
    },
  },
  {
    id: 'timeOdometer',
    title: 'Time - Odometer',
    yLabel: 'km',
    compute(entries) {
      return entries.map(e => ({ x: e.date, y: e.odometer }));
    },
  },
];

function destroyThumbCharts() {
  thumbCharts.forEach(c => c.destroy());
  thumbCharts = [];
}

function destroyModalChart() {
  if (modalChart) {
    modalChart.destroy();
    modalChart = null;
  }
}

function formatChartDate(isoString) {
  const d = new Date(isoString);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

function createThumbChart(canvas, data) {
  const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: data.map(d => formatChartDate(d.x)),
      datasets: [{
        data: data.map(d => d.y),
        borderColor: accentColor,
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.3,
        fill: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false },
        y: { display: false },
      },
      interaction: { enabled: false },
    },
  });
}

function openChart(chartDef, data) {
  const modal = document.getElementById('chart-modal');
  const canvas = document.getElementById('chart-modal-canvas');
  const title = document.getElementById('chart-modal-title');

  destroyModalChart();
  title.textContent = chartDef.title;
  modal.classList.add('active');
  history.pushState({ chartModal: true }, '');

  const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
  const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border').trim();

  const labels = data.map(d => formatChartDate(d.x));
  const values = data.map(d => d.y);

  modalChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: chartDef.title,
        data: values,
        borderColor: accentColor,
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: accentColor,
        tension: 0.3,
        fill: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(item) {
              return `${chartDef.yLabel}: ${item.parsed.y.toFixed(2)}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: textColor, maxTicksLimit: 8, maxRotation: 45 },
          grid: { color: borderColor },
        },
        y: {
          title: { display: true, text: chartDef.yLabel, color: textColor },
          ticks: { color: textColor },
          grid: { color: borderColor },
        },
      },
    },
  });
}

function closeChart(popState) {
  if (!document.getElementById('chart-modal').classList.contains('active')) return;
  destroyModalChart();
  document.getElementById('chart-modal').classList.remove('active');
  if (!popState) history.back();
}

async function renderCharts() {
  const allEntries = await getAllEntries(); // newest first
  const vehicles = await getDistinctVehicles();
  const vehicleSelect = document.getElementById('charts-vehicle');
  const content = document.getElementById('charts-content');
  const empty = document.getElementById('charts-empty');

  // Populate vehicle filter
  const currentVal = vehicleSelect.value;
  vehicleSelect.innerHTML = '<option value="all">All vehicles</option>' +
    vehicles.map(v => `<option value="${v}">${v}</option>`).join('');
  if (vehicles.includes(currentVal)) vehicleSelect.value = currentVal;

  // Filter and sort entries date ASC
  let entries = [...allEntries].reverse();
  const selectedVehicle = vehicleSelect.value;
  if (selectedVehicle !== 'all') {
    entries = entries.filter(e => e.vehicle === selectedVehicle);
  }

  entries.sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    return d !== 0 ? d : a.odometer - b.odometer;
  });

  if (entries.length === 0) {
    content.style.display = 'none';
    empty.style.display = 'block';
    destroyThumbCharts();
    return;
  }

  content.style.display = '';
  empty.style.display = 'none';
  destroyThumbCharts();

  // Render each thumbnail
  for (const def of CHART_DEFS) {
    const thumb = document.querySelector(`.chart-thumb[data-chart="${def.id}"]`);
    if (!thumb) continue;
    const canvas = thumb.querySelector('canvas');
    const data = def.compute(entries);
    if (data.length < 2) {
      // Not enough data — clear canvas
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      continue;
    }
    thumbCharts.push(createThumbChart(canvas, data));
  }
}

function setupCharts() {
  document.getElementById('charts-vehicle').addEventListener('change', () => {
    renderCharts();
  });

  // Click handlers on thumbnails
  document.querySelectorAll('.chart-thumb').forEach(thumb => {
    thumb.addEventListener('click', async () => {
      const chartId = thumb.dataset.chart;
      const def = CHART_DEFS.find(d => d.id === chartId);
      if (!def) return;

      const allEntries = await getAllEntries();
      let entries = [...allEntries].reverse();
      const selectedVehicle = document.getElementById('charts-vehicle').value;
      if (selectedVehicle !== 'all') {
        entries = entries.filter(e => e.vehicle === selectedVehicle);
      }
      entries.sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        return d !== 0 ? d : a.odometer - b.odometer;
      });

      const data = def.compute(entries);
      if (data.length < 2) return;
      openChart(def, data);
    });
  });

  // Close modal
  document.getElementById('chart-modal-close').addEventListener('click', () => closeChart());
  document.getElementById('chart-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeChart();
  });

  // Back button closes modal
  window.addEventListener('popstate', (e) => {
    if (document.getElementById('chart-modal').classList.contains('active')) {
      closeChart(true);
    }
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
  setupStats();
  setupCharts();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }

  window.addEventListener('hashchange', navigate);
  navigate();
}

document.addEventListener('DOMContentLoaded', init);

export { showToast, navigate };
