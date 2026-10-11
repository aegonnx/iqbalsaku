# mySaku visual system

## Direction

A compact daily money tracker with a white canvas, graphite text and a single jade accent. Taste's redesign-existing-projects skill guides the implementation in the existing vanilla CSS and JavaScript stack. This is a functional mobile app, so marketing effects, stock imagery, cinematic scrolling and framework migrations do not apply.

Design dials: DESIGN_VARIANCE 5, MOTION_INTENSITY 3, VISUAL_DENSITY 4. Strong hierarchy and varied section composition; restrained existing 180–240 ms interaction motion; comfortable daily-use density.

## Incumbent audit

The previous interface used emerald balance panels, blue action states, navy text, rainbow category charts and repeated bordered white cards. Outfit headings and Work Sans body text were already self-hosted. Read, Add, Analyze and Settings, native dialogs, keyboard-safe footers, saved themes and accessible focus were functional and are preserved. There are no public marketing pages, SEO landing routes, or analytics events to migrate.

Problems addressed: equal visual weight across unrelated cards; large tinted balance containers; inconsistent accents; category totals split over too many lines; excessive nested padding; heavy navigation selection tiles. Existing icons and the app logo are retained rather than replacing user identity assets.

## Composition

- Home: two large linked choices, Verse 01 — Expenses and Verse 02 — Money Plus. White expense surface, pale jade income surface, shared brand and theme.
- Money Plus: monthly income on the canvas, salary/extra columns, daily income groups, and an Overview with source totals and backups. It uses the existing keyboard layout and bottom-sheet motion, with its own records and stable form actions.
- Read: remaining balance on the page canvas, compact spent/budget columns, full-width food allowance surface, separate expense cards grouped by date.
- Analyze: total spending and budget position, two-column daily guidance, a segmented category chart with matching percentages and amounts, budget guidance and expandable biggest expenses.
- Settings: quiet collapsed surfaces, bordered expanded sections, sticky save controls.
- Add/Edit: native bottom sheet, prominent amount, immediately reachable category/source and description, optional date and notes, stable Save/Delete footer. Existing visualViewport behavior remains authoritative.
- Navigation: full-width bar anchored flush to the bottom with three established actions and a prominent center Add control. Bottom padding includes the device safe area; the bar hides during keyboard entry.

## Tokens and typography

`dist/design.css` owns the redesign layer. `dist/styles.css` retains the existing interaction and keyboard rules.

Light: white canvas, #202b28 text, #5b6964 secondary text, #23745b jade controls, pale green-gray grouped surfaces. Dark: #141a19 canvas, #edf2ee text, #b0bdb5 secondary text, #8cd4ae controls. Caution and danger colors communicate real budget states. At the user's request, categories use distinct green, amber, rose, blue, teal, purple and other coordinated colors with tinted icons and matching chart segments. Labels and numbers accompany colors. Category colors stay stable through reordering, and custom categories receive a stable color based on their ID.

Work Sans is the UI and heading voice; Outfit supplies balance and major numeric displays and the established wordmark. Use medium and semibold weights, tabular numerals and restrained negative tracking. Currency prefixes are visually subordinate without changing accessible amount text.

Radius scale: 10 px category icons, 12 px inputs and expense rows, 16 px grouped surfaces, 24 px bottom sheet. Bottom navigation has square edges and a top divider. Shadows are confined to menus and dialogs, tinted green-gray. Focus remains visible. No decorative imagery, fake records, new metrics or claims.

## Verification boundaries

Verify both themes, 320–430 px mobile widths, desktop containment, 200% text, named dialogs, essential category/footer visibility under simulated visualViewport changes, reduced motion, expense edits/deletion and mocked multi-device sync. Automated browser simulations do not establish physical iOS/Android keyboard behavior or actual screen-reader speech.
