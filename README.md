# Iqbal Saku

A simple mobile expense tracker with Read, Add, and Analyze screens. Vanilla HTML, CSS, and JavaScript; the official Supabase client is bundled locally for sign-in and sync.

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
