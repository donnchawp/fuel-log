// import-export.js
import { getAllEntries, getEntriesByVehicle, getEntriesByDateRange, importEntries } from './db.js';

export async function exportJSON(entries) {
  const data = JSON.stringify(entries, null, 2);
  downloadFile(data, 'fuel-log-export.json', 'application/json');
}

export async function exportCSV(entries) {
  const headers = ['id','date','vehicle','odometer','fuelAmount','fuelUnit','cost','currency','fuelType','location','notes','createdAt','modifiedAt'];
  const rows = entries.map(e =>
    headers.map(h => csvEscape(String(e[h] ?? ''))).join(',')
  );
  const csv = [headers.join(','), ...rows].join('\n');
  downloadFile(csv, 'fuel-log-export.csv', 'text/csv');
}

function csvEscape(value) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseJSONImport(text) {
  const data = JSON.parse(text);
  const entries = Array.isArray(data) ? data : [];
  // Validate required fields
  return entries.filter(e => e.id && e.date && typeof e.odometer === 'number');
}

export function parseCSVImport(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const entry = {};
    headers.forEach((h, i) => {
      entry[h] = values[i] ?? '';
    });
    // Generate ID if missing, coerce numbers
    if (!entry.id) entry.id = crypto.randomUUID();
    entry.odometer = Number(entry.odometer) || 0;
    entry.fuelAmount = Number(entry.fuelAmount) || 0;
    entry.cost = Number(entry.cost) || 0;
    if (!entry.createdAt) entry.createdAt = new Date().toISOString();
    if (!entry.modifiedAt) entry.modifiedAt = new Date().toISOString();
    return entry;
  });
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}

export async function getExportEntries(scope, { vehicle, startDate, endDate } = {}) {
  if (scope === 'vehicle' && vehicle) return getEntriesByVehicle(vehicle);
  if (scope === 'dateRange' && startDate && endDate) return getEntriesByDateRange(startDate, endDate);
  return getAllEntries();
}

export { importEntries };
