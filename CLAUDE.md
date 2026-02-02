# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fuel Log PWA — a fully local, offline-first Progressive Web App for recording fuel purchases. No backend, no login, no cloud services. All data stored in IndexedDB on the user's device.

## Tech Stack

- Vanilla HTML/CSS/JS (ES modules), no framework, no build step
- CSS custom properties for dark mode theming
- Hash-based routing (~20 line custom router)
- [idb](https://github.com/jakearchibald/idb) v8 (vendored as `idb.js`) for IndexedDB access
- Hand-written service worker for offline caching

## Running Locally

Serve from the project root with any static HTTP server:

```bash
python3 -m http.server 8000
# or
npx serve .
```

Open `http://localhost:8000` in a browser. No build or install step required.

## File Structure

| File | Purpose |
|---|---|
| `index.html` | Single HTML file containing all four screen sections and bottom nav |
| `styles.css` | All styles — CSS custom properties for light/dark theming, layout, forms, lists |
| `app.js` | Router, UI logic, form handling, screen setup, service worker registration |
| `db.js` | IndexedDB data layer — CRUD, bulk operations, import, storage estimation |
| `settings.js` | LocalStorage settings — load, save, theme application, system theme listener |
| `import-export.js` | JSON and CSV export/import with validation and duplicate handling |
| `sw.js` | Service worker — precaches app shell, cache-first fetch strategy |
| `idb.js` | Vendored idb library (do not edit — re-vendor from npm if updating) |
| `manifest.json` | PWA manifest for installability |
| `icons/` | PWA icons (192px, 512px placeholder PNGs) |

## Data Model

**IndexedDB** database `fuel-log`, object store `entries`, key path `id`.

Each entry:
- `id` — UUID v4 (via `crypto.randomUUID()`)
- `createdAt`, `modifiedAt` — ISO-8601 timestamps
- `date` — ISO-8601 (indexed)
- `vehicle` — string (indexed, optional)
- `odometer` — number (required)
- `fuelAmount` — number, `fuelUnit` — "litres" | "gallons"
- `cost` — number, `currency` — string (e.g. "EUR")
- `fuelType` — "petrol" | "diesel" | "ev" | "other"
- `location`, `notes` — optional strings

**Settings** stored in LocalStorage under key `fuel-log-settings`:
- `defaultVehicle`, `fuelUnit`, `currency`, `darkMode` ("system" | "light" | "dark")

## Service Worker Updates

When changing any cached file, bump the cache version in `sw.js`:

```js
const CACHE_NAME = 'fuel-log-v2'; // was v1
```

Also update the `ASSETS` array if files are added or renamed.

## No Build, No Tests, No Linter

This project has no build step, no test runner, and no linter configured. All files are served directly as static assets.

## Architecture Constraints

- Frontend-only, no server dependency
- Service worker for offline support and app shell caching
- Schema versioning for future upgrades (idb `upgrade` callback in `db.js`)
- Import must never delete existing data
- Installable as PWA on Android and iOS
