# mySaku

mySaku (formerly Iqbal Saku) is one personal money tracker for starting salary, extra income, expenses, and budgets. The homepage opens the tracker directly. Vanilla HTML, CSS, and JavaScript; the official Supabase client is bundled locally for account sync.

## Starting budget and extra income

- In Settings → Monthly budgets, manually enter the selected month's starting budget / salary. `5000` means Rp5.000.000. Category budgets remain separate spending limits.
- Use **Add income** on Read when a bonus, freelance payment, gift, refund, or other income arrives. Enter amount, source, and date received; description and note are optional. The existing thousands input and rupiah preview also apply to income.
- Remaining money = starting budget + extra income − expenses − emergency funds. Rp5.000.000 salary + Rp500.000 bonus − Rp1.000.000 expenses leaves Rp4.500.000. Salary is entered as the starting budget only, never as extra income.
- Read shows starting budget, extra income, total expenses, remaining money, and one Money in & out history with editing and deletion. Income has green plus amounts; expenses have red minus amounts. The expense entry flow and category limits are unchanged. Analyze keeps expense breakdowns and uses all available money for overall spending guidance.
- Both expenses and income follow the configured budget period's start day (1–28). JSON backups, account sync, and offline storage include income. CSV marks expenses, income, and saved salary references distinctly.

## Emergency funds

The dashboard shows Emergency funds in place of Total available. Set the amount in **Settings → Monthly budgets**, directly below starting budget / salary, using thousands (500 = Rp500.000). The reserve reduces remaining money without creating an expense or changing category totals. It is saved for the selected budget period, defaults to zero for older records and new months, and is included in account sync, offline storage, and JSON backups. Clear the field or enter zero to release the reserve.

## Income sources

In **Settings → Income sources**, rename, add, reorder, or delete the categories used by Add income. Renaming keeps existing records linked to the source. Deleting a source asks where to move its records and leaves amounts, dates, notes, budgets, and remaining money intact. At least one source remains; starting salary stays in Monthly budgets. Sources are included in account sync, offline storage, and JSON backups; search and CSV exports use their saved names. Older backups receive the original source list automatically.

## Preserving saved data

The existing `saku-expenses-v1` database and Supabase version-1 document remain in use. Old backups without income still restore normally. No backend schema migration is required.

Saved Money Plus records in `saku-money-plus-v1` are imported once into the signed-out tracker when the updated app opens. The old database is retained untouched. Stable record IDs and an import ledger prevent repeated imports, including after deleting an imported record or resetting the tracker. The former app URLs redirect to the main tracker and keep supported hash bookmarks.

Previously saved salary records are preserved as references, excluded from extra income. Existing monthly budgets (including explicit zero budgets) and nonzero default budgets are preserved. Only a period without a saved budget and with a zero default budget gets its starting budget initialized from saved salary. To change starting funds later, edit Monthly budgets.

Signed-out device data remains separate from signed-in accounts. In Settings → Your data, **Import saved income into this account** merges the old device income into the selected account without replacing expense records or existing budgets. Importing a Money Plus JSON backup performs the same merge. An ordinary tracker JSON restore replaces financial records after confirmation and retains the import ledger to avoid bringing back already-consumed legacy data.

## Appearance and month navigation

Settings → Color palette offers Jade and Ocean blue. The selection is remembered on this device and works in both light and dark themes. The month arrows have separate 48-pixel touch targets, with a gap and a contained center month picker. The visible brand, browser title, and install name are mySaku; existing database names, backup format, PWA identity, and saved theme preferences are retained.

## Run locally

Requires Node.js 20 or newer. Run `npm start`, then open `http://localhost:4173`.

## Daily use

- Read shows the remaining monthly money, money in and out grouped by date. Category budgets remain available in Settings and Analyze.
- Add expenses from the center button in the bottom navigation. Amount and category are required. Date is visible beside Amount; Category and optional Description form the second row. Notes remain in Details.
- Analyze shows spending by category and budget status. Each category has a collapsed expense list you can expand to view descriptions, dates, notes, and amounts, sorted from highest to lowest; expenses can be edited directly from the list. Saved monthly summary amounts are identified separately because they have no individual records. A Spending overview paragraph explains your remaining money, category limits, and spending pace, with suggestions to leave room for essentials and upcoming bills. It uses recorded totals locally, requires no AI service, and adjusts its wording for past/future periods, summaries, and missing budgets. The settings button contains budgets, categories, quick entries, and backups.
- All money inputs default to thousands: `500` stores 500,000 and `10` stores 10,000. `10k` also works. The live preview shows the full amount; existing records and backups retain full numeric values. IDR displays with Indonesian separators.
- The date defaults to the device's local date.
- Selecting a category closes the filter panel while keeping the results filtered. Month labels use Jan, Feb, Sep, Oct, and similar abbreviations.

## Data

This public version starts with no expenses, historical summaries, or budgets. Configure budgets in Settings or import your own JSON backup. Personal backups are not included in this repository.

Expenses and income persist in IndexedDB on each device. Sign in through Settings to sync through Supabase. Signed-out device data stays separate from account data. Import a JSON backup after signing in to move your records into the account. Use regular browsing and keep JSON backups; clearing website data or ending a private browsing session can remove local records.

## Cloudflare Pages

Deploy the `dist` folder as a static website. For Git integration, select `main`, framework preset **None**, build command `exit 0`, and output directory `dist`. No server or environment variables are required.

Open the HTTPS site on an iPhone in Safari, then Share → Add to Home Screen. Open it once online to cache the app for offline use. Import your private JSON backup on the device where you want to track expenses.

## Tests and code

Run `npm test` for calculations, expense and income changes, budget periods, migration, backups, and sync using synthetic data. With `npm start` running, use `npm run test:income:browser` for the combined tracker and real service-worker offline checks. Install Playwright Chromium or set `PLAYWRIGHT_EXECUTABLE_PATH` to an installed browser. Run `node tests/income-sources-browser.cjs` for source management, backups, and real offline entry. Existing reports, motion, hardening, and cloud browser tests cover expense regressions; cloud tests simulate Supabase rather than signing into a real user account.

- `dist/model.mjs`: numeric values, validation, budgets, reports, and CSV.
- `dist/income-model.mjs`, `dist/income-ui.mjs`: income validation and entry/history.
- `dist/income-legacy.mjs`: safe consolidation of saved income.
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


On touch screens, pull down at the top of a page and release to refresh the current tracker data and sync online. Refresh is disabled while entering an expense or income, or saving.
Editing dialogs keep Save and Delete in a footer outside the scrolling fields. Settings save controls stay above navigation, and Visual Viewport resizing keeps controls within the visible area when a phone keyboard opens. Keyboard layout was verified with a simulated viewport; actual iPhone and Android keyboards still need device testing.

## Motion and mobile interaction

For several expenses on the same date, use **Save + next** in Add expense. Each tap saves one transaction and clears amount, description and note in place, preserving date and category. **Save expense** saves the final item and closes the editor. The compact footer keeps the same height; edit/delete controls remain unchanged. `tests/multi-expense-browser.cjs` covers repeat entry, totals, persistence, validation and duplicate-tap protection with simulated keyboards in both themes.

Dialogs use one native autofocus step during the user's tap, with 240 ms entry and 180 ms exit animations. Exit completion controls dismissal instead of an arbitrary timeout. Keyboard geometry writes are coalesced once per animation frame and unchanged values are skipped. Save and Delete remain outside the scrolling fields; a second open or submit cannot replace a draft or duplicate a save.

Edit opens without activating the keyboard. Expense entry uses Amount | Date and Category | Description above the keyboard, with aligned controls and consistent row spacing. Income retains a full-width amount followed by source and description. Add automatically focuses the thousands amount input. The header's Details button exposes notes and recent expense suggestions (and the date for income) in a separate scrolling area; Entry returns to the main fields. Save stays in the fixed dialog footer. Dialogs have accessible names, navigation focuses the page heading, and replacement renders restore relevant same-page focus. Page titles and month controls are inside the main landmark.

Large histories render 60 matching expenses initially. Show more expenses loads another 60; search, category, and month changes reset the batch. Daily totals and monthly budgets always include all applicable records, including those not yet rendered. Search reuses a sorted text index and groups matches in one pass.

Navigation, disclosures, theme colors, and pull-refresh use restrained 180–240 ms motion. Theme switching retains focus, settings retain their expanded section after saving, and reduced-motion users get immediate dialogs and disclosures. `dist/motion.mjs` manages these transitions.

`tests/motion-browser.cjs` runs isolated mobile Chromium checks at 320, 390, and 430 pixels in both themes, with simulated keyboard viewport changes and reduced motion. `tests/cloud-browser.cjs` covers the complete expense and simulated Supabase workflow. These scripts use Playwright with an installed browser; they do not access a user's browser data. Actual iOS Safari and Android keyboard motion still require testing on physical devices.

`tests/hardening-browser.cjs` checks history pagination and complete totals, filter resets, named dialogs, deleting without opening the keyboard, and inline amount-error recovery. PRODUCT.md records the confirmed product scope for future UI work; .impeccable/live/config.json targets the local app shell without injecting anything into production.

## Visual design

The Taste redesign uses white and graphite surfaces with a single jade accent in both themes. Read emphasizes remaining balance and a combined money history; Analyze shows total spending, a segmented category chart and daily guidance. `dist/design.css` owns the visual layer while the original stylesheet retains keyboard layout mechanics. DESIGN.md records the visual decisions. Income uses the same version-1 financial document and account sync as expenses.

`node tests/reports-browser.cjs` verifies chart percentages, complete totals, category budgets, historical summaries, over-budget states and empty months in both themes using synthetic data.

`node tests/appearance-browser.cjs` verifies the mySaku brand, remembered palette, money-in/out colors and filters, and the full month-arrow touch targets at 320/390/430 pixels in both themes.
