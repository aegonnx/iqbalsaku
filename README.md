# Iqbal Saku

A personal money hub with two separate apps: **Verse 01 — Expenses** for spending and budgets, and **Verse 02 — Money Plus** for salary, bonuses, and extra income. Vanilla HTML, CSS, and JavaScript; the expense app's official Supabase client is bundled locally for sign-in and sync.

## Choose an app

The homepage offers two choices. Expenses opens at `/expenses.html`; Money Plus opens at `/money-plus.html`. Each app links back home. Existing expense bookmarks such as `/#settings` redirect to the expense page. The installed PWA opens the chooser and caches both apps for offline use. Keep the same hosting domain to preserve existing browser data.

Money Plus has its own IndexedDB database (`saku-money-plus-v1`), separate from expense storage (`saku-expenses-v1`). It never reads expense records or changes expense budgets. Existing expense data and account sync keep their original storage and behavior.

## Money Plus

- Add salary, work bonuses, freelance pay, gifts, refunds, and other income on any date. For example, a Rp500.000 bonus received mid-month is entered as `500`, with source Work bonus and the date received.
- Amount and source are the essential fields; date defaults to today. Title defaults to the source name, and title/note can be customized. Amounts use the expense app's existing thousand-entry convention with a live rupiah preview.
- View calendar-month income, salary, extra income (all sources other than Salary), daily totals, and comparison with the previous month. Extra income is part of total income, not an expense budget increase or an available-balance calculation.
- Edit and delete records, search titles/notes, filter by source, and browse months. History displays 60 matches at a time while totals include every matching record.
- Overview shows source breakdown, all-time recorded income, JSON backup export/import, and income CSV export. Imports add missing records, skip identical IDs, and ask whether to keep current or backup versions when records differ. Expense backups are rejected.
- Income saves on the current device and works offline after the site has loaded online. It does not use Supabase account sync. Export JSON backups before clearing browser data or to transfer income between devices.

Run `npm install` to install browser-test tooling. With `npm start` running in another terminal, run `npm run test:money-plus:browser`. Use `npx playwright install chromium` if a browser is not installed, or set `PLAYWRIGHT_EXECUTABLE_PATH` to an installed Chromium browser. The browser tests use synthetic records in isolated browser contexts.

## Run locally

Requires Node.js 20 or newer. Run `npm start`, then open `http://localhost:4173`.

## Daily use

- Read shows the remaining monthly budget, a full-width Makan budget card with its recommended daily allowance, and expenses grouped by date.
- Add expenses from the center button in the bottom navigation. Amount and category are required; description, date, and note are optional details.
- Analyze shows spending by category and budget status. The settings button contains budgets, categories, quick entries, and backups.
- All money inputs default to thousands: `500` stores 500,000 and `10` stores 10,000. `10k` also works. The live preview shows the full amount; existing records and backups retain full numeric values. IDR displays with Indonesian separators.
- The date defaults to the device's local date. Daily recommendations divide the remaining category budget by days after today, or the full period for future months.
- Selecting a category closes the filter panel while keeping the results filtered. Month labels use Jan, Feb, Sep, Oct, and similar abbreviations.

## Data

This public version starts with no expenses, historical summaries, or budgets. Configure budgets in Settings or import your own JSON backup. Personal backups are not included in this repository.

Expenses persist in IndexedDB on each device. Sign in through Settings to sync through Supabase. Signed-out device data stays separate from account data. Import a JSON backup after signing in to move your records into the account. Use regular browsing and keep JSON backups; clearing website data or ending a private browsing session can remove local records.

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

## Supabase setup

1. Run `supabase/schema.sql` in your project's SQL Editor. It creates the account table, own-account read policy, and authenticated save function with revision checks. Browser users cannot write directly to the table or access other users' records.
2. In Authentication → URL Configuration, set Site URL and an allowed Redirect URL to `https://iqbalsaku.pages.dev/`.
3. Enable email/password sign-in. Confirm your email when creating an account. If Supabase's default mail provider cannot deliver to your address, configure custom SMTP or create/confirm your own user in Authentication → Users; never disable data access policies.
4. `dist/cloud-config.mjs` contains only the project URL and public publishable key. No database password, secret key, or service-role key belongs in browser assets or Git.
5. Push to GitHub; Cloudflare deploys `dist` unchanged. The official client is already bundled. To rebuild the SDK after updates: `npm install`, then `npm run build:client`.
6. On each device, sign in to the same account. Import your backup once. Pending offline changes retry online, when the app becomes visible, or every 30 seconds while open. Same-field conflicts require choosing a copy in Settings; the discarded copy downloads as JSON first.

Account data is cached under a separate IndexedDB key for offline use. Signing out switches back to signed-out device data and requires pending changes to finish syncing first. Supabase and email delivery setup still need live verification.


On touch screens, pull down at the top of a page and release to refresh the current expense data and sync online. Refresh is disabled while entering an expense or saving.
Editing dialogs keep Save and Delete in a footer outside the scrolling fields. Settings save controls stay above navigation, and Visual Viewport resizing keeps controls within the visible area when a phone keyboard opens. Keyboard layout was verified with a simulated viewport; actual iPhone and Android keyboards still need device testing.

## Motion and mobile interaction

Dialogs use one native autofocus step during the user's tap, with 240 ms entry and 180 ms exit animations. Exit completion controls dismissal instead of an arbitrary timeout. Keyboard geometry writes are coalesced once per animation frame and unchanged values are skipped. Save and Delete remain outside the scrolling fields; a second open or submit cannot replace a draft or duplicate a save.

Edit opens without activating the keyboard. With the keyboard open, the header's Details button exposes description, date, note, and recent suggestions in a separate scrolling area; Amount returns to the essential fields. Dialogs have accessible names, navigation focuses the page heading, and replacement renders restore relevant same-page focus. Page titles and month controls are inside the main landmark.

Large histories render 60 matching expenses initially. Show more expenses loads another 60; search, category, and month changes reset the batch. Daily totals and monthly budgets always include all applicable records, including those not yet rendered. Search reuses a sorted text index and groups matches in one pass.

Navigation, disclosures, theme colors, and pull-refresh use restrained 180–240 ms motion. Theme switching retains focus, settings retain their expanded section after saving, and reduced-motion users get immediate dialogs and disclosures. `dist/motion.mjs` manages these transitions.

`tests/motion-browser.cjs` runs isolated mobile Chromium checks at 320, 390, and 430 pixels in both themes, with simulated keyboard viewport changes and reduced motion. `tests/cloud-browser.cjs` covers the complete expense and simulated Supabase workflow. These scripts use Playwright with an installed browser; they do not access a user's browser data. Actual iOS Safari and Android keyboard motion still require testing on physical devices.

`tests/hardening-browser.cjs` checks history pagination and complete totals, filter resets, named dialogs, deleting without opening the keyboard, and inline amount-error recovery. PRODUCT.md records the confirmed product scope for future UI work; .impeccable/live/config.json targets the local app shell without injecting anything into production.

## Visual design

The Taste redesign uses white and graphite surfaces with a single jade accent in both themes. Read emphasizes remaining balance and the daily Makan allowance; Analyze shows total spending, a segmented category chart and daily guidance. `dist/design.css` owns the visual layer while the original stylesheet retains keyboard layout mechanics. DESIGN.md records the visual decisions. No financial schema or sync behavior changes are required.

`node tests/reports-browser.cjs` verifies chart percentages, complete totals, full-width Makan layout, historical summaries, over-budget states and empty months in both themes using synthetic data.
