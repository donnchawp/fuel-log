// db.js
import { openDB } from './idb.js';

const DB_NAME = 'fuel-log';
const DB_VERSION = 1;
const STORE_NAME = 'entries';

function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('date', 'date');
        store.createIndex('vehicle', 'vehicle');
      }
    },
  });
}

export async function addEntry(entry) {
  const db = await getDb();
  const now = new Date().toISOString();
  const record = {
    id: crypto.randomUUID(),
    createdAt: now,
    modifiedAt: now,
    ...entry,
  };
  await db.put(STORE_NAME, record);
  return record;
}

export async function updateEntry(entry) {
  const db = await getDb();
  const existing = await db.get(STORE_NAME, entry.id);
  if (!existing) throw new Error('Entry not found');
  const record = {
    ...existing,
    ...entry,
    modifiedAt: new Date().toISOString(),
  };
  await db.put(STORE_NAME, record);
  return record;
}

export async function deleteEntry(id) {
  const db = await getDb();
  await db.delete(STORE_NAME, id);
}

export async function deleteEntries(ids) {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await Promise.all([
    ...ids.map(id => tx.store.delete(id)),
    tx.done,
  ]);
}

export async function getEntry(id) {
  const db = await getDb();
  return db.get(STORE_NAME, id);
}

export async function getAllEntries() {
  const db = await getDb();
  const entries = await db.getAllFromIndex(STORE_NAME, 'date');
  return entries.reverse(); // newest first
}

export async function getEntriesByVehicle(vehicle) {
  const db = await getDb();
  return db.getAllFromIndex(STORE_NAME, 'vehicle', vehicle);
}

export async function getEntriesByDateRange(startDate, endDate) {
  const db = await getDb();
  const range = IDBKeyRange.bound(startDate, endDate);
  const entries = await db.getAllFromIndex(STORE_NAME, 'date', range);
  return entries.reverse();
}

export async function getEntryCount() {
  const db = await getDb();
  return db.count(STORE_NAME);
}

export async function importEntries(entries, overwrite = false) {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const results = { added: 0, skipped: 0, overwritten: 0 };

  for (const entry of entries) {
    const existing = await tx.store.get(entry.id);
    if (existing) {
      if (overwrite) {
        await tx.store.put(entry);
        results.overwritten++;
      } else {
        results.skipped++;
      }
    } else {
      await tx.store.put(entry);
      results.added++;
    }
  }

  await tx.done;
  return results;
}

export async function estimateStorageUsage() {
  if (navigator.storage && navigator.storage.estimate) {
    const { usage, quota } = await navigator.storage.estimate();
    return { usage, quota };
  }
  return null;
}
