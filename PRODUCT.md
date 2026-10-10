# Iqbal Saku

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Iqbal is the primary user. He records personal everyday expenses on his phone and checks the same account on his computer. The scope is a personal tracker; a public, multi-user product offering has not been requested.

## Product Purpose

Replace typing expenses into ChatGPT with a quick daily routine: open the app, enter an expense in a few seconds, and immediately understand the remaining monthly budget. Keep the experience simple rather than turning it into an accounting system.

Success means reliable saving, correct balances after every change, fast entry with little typing, and clear spending guidance.

## Operating Context

- Design primarily for an iPhone-sized screen and one-handed use. Android mobile browsers and desktop browsers must remain usable; larger screens retain the compact phone-oriented flow.
- The app can be installed as a PWA and used offline after its shell has been cached.
- The main navigation is Read, Add, and Analyze. Settings are reached through the top settings button.
- Read prioritizes remaining monthly budget, followed by total spending, one full-width Makan budget card with its daily allowance, and expenses grouped by date.
- Add is the central bottom-navigation action. Edit opens without activating the keyboard; tapping a field starts editing, and Delete is immediately available.
- Analyze provides monthly totals, category breakdowns, budget comparisons, and spending guidance. Month navigation uses short title-case labels such as Sep and Oct.
- Optional Supabase sign-in keeps account expenses available across devices. Signed-out device records and signed-in account records remain separate. Moving device records into an account requires importing a backup after signing in.

## Capabilities and Constraints

- Amount entry defaults to thousands: typing `500` means 500,000. Show the full amount in a live preview and store full numeric values. Preserve exact decimal entry and existing backup values. Do not restore a unit-switch button.
- Default currency is IDR / Rp, formatted with Indonesian separators, such as Rp2.500.000. Preserve configurable currency and budget-period start day.
- Amount and category are the essential expense fields. Date defaults to the device's local date; description and note are optional details. Preserve quick expenses and recent-description suggestions.
- Keep Category reachable without scrolling when the mobile keyboard is open. Optional details may scroll; Save and Delete stay stable outside the scrolling fields and above the keyboard.
- Support adding, editing, deleting, changing categories and dates, search, and category filtering. Choosing a category closes the search/filter panel while retaining the filter.
- Support monthly overall budgets and optional category budgets. Recalculate spending, remaining budget, category totals, and daily recommendations after every relevant change or import.
- Budget states use under 70% as normal, 70–90% as caution, 90–100% as warning, and over 100% as over budget. Do not add an On track label to the Makan card or restore the separate Dating card on Read.
- The Makan recommendation uses its own remaining budget and days after today. Preserve the meaning of From tomorrow; future periods use their full duration.
- Categories can be created, renamed, reordered, and deleted. Default categories include Makan, Snack, Dating, Kebutuhan Rumah, Transport, Sosial / Entertainment, Peralatan Kerja, Bantu Ibu, Lain-lain, Paket Data, and Sedekah / Sosial.
- Adding a default category must not recategorize old expenses or duplicate a user's existing category. Renamed or deleted defaults must stay that way.
- Persist expenses locally in IndexedDB. Keep offline saves available while online sync is pending, isolate account data, and resolve conflicting edits explicitly rather than silently replacing records.
- Preserve JSON export/import, transaction CSV export, and confirmed reset. Preserve historical monthly summaries without inventing individual dates or transactions.
- The public build starts empty. Never include personal backups, private financial records, passwords, or secret/service-role keys in public assets or Git.
- Retain the lightweight existing implementation: static HTML, CSS, JavaScript modules, IndexedDB, and a locally bundled Supabase client. Cloudflare Pages serves the dist directory; no app server is required for hosting.
- Prevent duplicate dialogs and duplicate saves. Pull-to-refresh uses a moving circle and is disabled during expense entry or saving.
- AI chat is outside the current scope; the user chose to leave it out.

## Brand Commitments

- Keep the name Iqbal Saku in the app, browser tab, and installation metadata.
- Preserve the user's direction: modern, minimal, professional, uncluttered, and mobile-first, with clear hierarchy and distinct expense rows.
- White is the default theme. Keep the top theme switch, the dark alternative, and the remembered choice.
- Use neutral transaction wording. Do not add report-source labels or notes to imported expenses.
- Keep the simple Read / Add / Analyze terminology. Use plain, practical interface copy.

## Evidence on Hand

- User requirements and corrections in this project conversation establish the personal-tracker scope and daily workflows.
- README.md describes local use, deployment, backups, and account sync.
- dist/app.mjs and dist/styles.css implement the current interface; dist/model.mjs defines calculations, validation, categories, and reports.
- dist/storage.mjs, dist/sync.mjs, and supabase/schema.sql implement local persistence and account sync.
- dist/icon.svg and the PWA icon files contain the existing app identity assets.
- tests/*.test.mjs cover calculations, storage upgrades, amount entry, refresh behavior, and sync. tests/motion-browser.cjs and tests/cloud-browser.cjs cover mobile interactions using synthetic data.
- Browser checks simulate keyboard geometry and online services. Actual iOS Safari and Android keyboard behavior still requires physical-device verification.
- Private expense backups are not public content or design fixtures. Do not fabricate testimonials, usage statistics, customers, or commercial claims.

## Product Principles

1. Make daily expense entry fast and require as little typing as possible.
2. Make the remaining budget and food allowance understandable at a glance.
3. Preserve financial data and calculation accuracy through edits, imports, offline use, and sync.
4. Keep phone interactions stable and predictable, especially when the keyboard opens.
5. Improve within the simple established workflow; add complexity only when the user requests it.

## Accessibility & Inclusion

Keep readable text, large touch targets, visible focus, clear labels, and both-theme contrast. Support narrow screens and text resizing without covering essential controls. Respect reduced-motion preferences and use restrained, consistent transitions around 180–280 ms. Communicate budget states through text or values as well as color.

## Open Decisions

- No shared landing-page or showcase-page build-workflow preference is recorded. App screens are built directly in code.
- No public commercial positioning, pricing, or broader audience has been established.
- The user requested a noticeable visual redesign using Taste on October 10, 2026. DESIGN.md records the new white, graphite and jade mobile interface while preserving product behavior.
