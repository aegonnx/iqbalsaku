# Iqbal Saku

A simple mobile expense tracker with Read, Add, and Analyze screens. Vanilla HTML, CSS, and JavaScript; no runtime dependencies.

## Run locally

Requires Node.js 20 or newer. Run `npm start`, then open `http://localhost:4173`.

## Daily use

- Read shows the remaining monthly budget, a full-width Makan budget card with its recommended daily allowance, and expenses grouped by date.
- Add expenses from the center button in the bottom navigation. Amount and category are required; description, date, and note are optional details.
- Analyze shows spending by category and budget status. The settings button contains budgets, categories, quick entries, and backups.
- Amounts support shorthand such as `10k`; IDR displays with Indonesian separators.
- The date defaults to the device's local date. Daily recommendations divide the remaining category budget by days after today, or the full period for future months.
- Selecting a category closes the filter panel while keeping the results filtered. Month labels use Jan, Feb, Sep, Oct, and similar abbreviations.

## Data

This public version starts with no expenses, historical summaries, or budgets. Configure budgets in Settings or import your own JSON backup. Personal backups are not included in this repository.

Expenses persist in IndexedDB on each device. This release has no login or cloud synchronization. Hosting makes the app reachable online, but does not move your expenses into a shared database. Use regular browsing and keep JSON backups; clearing website data or ending a private browsing session can remove local records.

## Cloudflare Pages

Deploy the `dist` folder as a static website. For Git integration, select `main`, framework preset **None**, build command `exit 0`, and output directory `dist`. No server or environment variables are required.

Open the HTTPS site on an iPhone in Safari, then Share → Add to Home Screen. Open it once online to cache the app for offline use. Import your private JSON backup on the device where you want to track expenses.

## Tests and code

Run `npm test` for calculations, expense changes, month changes, and backup validation using synthetic test data.

- `dist/model.mjs`: numeric values, validation, budgets, reports, and CSV.
- `dist/storage.mjs`: IndexedDB repository.
- `dist/app.mjs`: user interface.
- `dist/styles.css`: mobile layout, white/dark themes, local fonts.
- `dist/sw.js`: offline app shell.
- `server.cjs`: local static preview only.

Cloud synchronization can be added behind the repository boundary later. No private credentials belong in browser assets or Git.
