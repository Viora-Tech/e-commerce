# Page pass 12: Online store (themes, theme import, import report, pages, preferences, SEO)

Audit section 7, row 12. Branch `design/page-online-store` (from origin/dev 79a2f8681). Visual and
state consistency only: publish, duplicate, rename, delete, versions, import, page save and every
preference save work as before. The theme customizer and code editor (`themes/customize/**`,
`themes/code/**`, the `(editor)` route) are left alone; their loader and error routes were already
in place (#1688). The two version-history dialogs (library and editor) are untouched; the owner has
not picked one.

Navigation (`/content/menus`) and Domains (`/settings/domains`) live under Content and Settings,
so their passes cover them.

## Failed loads

- New `components/states/server-load-failed.tsx` + `lib/load-failure.ts`: a server page whose read
  fails shows "Could not load …" with Try again (re-asks the server with `router.refresh`, the
  button spins) or "You do not have access" for a role that may not read it. Before, every failure
  said "Theme unavailable / You need access to the online store", which was wrong for a network or
  server error.
- Used by Themes ("Could not load themes"), Preferences ("Could not load preferences"), SEO
  ("Could not load the SEO report") and the import report ("Could not load the import report"; a
  theme that was not imported still says so). New copy + Hindi. The old `unavailable` copy of
  Preferences and SEO is gone (unused).
- Pages list: a failed read shows "Could not load pages" with Try again inside the table, under the
  header (was an inline box that replaced the table); a failed refresh after a row action lands
  there too (was swallowed).

## Themes

- On PageBody (was ProoflyPageBody). Theme library is a DataCard (title, line, Add theme, flush
  rows); its empty state is EmptyState with the two buttons. The live theme card sits on the ui
  Card (the surface DataCard draws on). Web performance and Section packs are DataCards; the metric
  tiles are `rounded-lg` (were `rounded-xl`). The import callout is a neutral Alert with its button.
- Publish spins on the row that was pressed; Duplicate current theme spins; Add theme and Rename
  spin only their own dialog. Delete keeps its dialog open and spinning until the theme is gone (a
  failure leaves it open with the toast), instead of closing at once.
- Loading screen rebuilt from the page's parts: real title and two header buttons, the live card
  (stage, then the name line and three buttons), the Theme library card with its real title and two
  rows. The old one drew the preview beside the text, which the page does not do.
- Phone frame border `5px` → `0.3125rem`.

## Theme import and import report

- Import screen on PageBody `detail`; the working and details panels on the ui Card; the failure is
  an Alert `danger` with "Choose another file" in its action slot (was a hand-made red box,
  `rounded-xl`). Loader: no header buttons, one card.
- Import report: the five raw Cards are DataCards; the swap and section tables are SimpleTable.
  Loader: two header buttons, four cards.

## Pages

- `/online-store/pages` has its own loader: real title, Add page and the real ResourceTable in its
  loading state with the Pages columns (`page-columns.tsx`, shared by list and skeleton).
- Page form: the title + content card is a DataCard titled "Page" (new copy + Hindi); "This page's
  content comes from its theme template" is an info Alert (was a dashed box).

## Preferences and SEO

- Preferences: the "store is password protected" note in Search engines is an info Alert; the
  loader no longer draws a back link the page does not have.
- SEO: the impact filter is PillTabs (`pill`) instead of hand-made toggle buttons; the two top cards
  sit 1.5rem apart like the rest of the page; own loader (header, two cards side by side, issues).
- Both still use SettingsCard: the settings pass (wt-w3g) turns SettingsCard into a DataCard, so
  these cards follow when it merges.

## Shared files touched

- New: `components/states/server-load-failed.tsx`, `lib/load-failure.ts` (no existing file changed).
- `data/content.ts` / `data/hi/content.ts`: `pagesListContent.loadFailed`, `onlineStoreContent.form.heading`.

## Tests

- `components/online-store/pages-list-skeleton.test.tsx`: same header cells as the loaded table, real title.
- `components/states/server-load-failed.test.tsx`: heading + Try again refreshes; no-access has no
  retry; `loadFailure` mapping.

## Left alone

- Customizer and code editor chrome, `customizer-top-bar`, segmented-tabs, the second shortcuts
  dialog (all editor family; audit row 12 lists them, the owner kept them out of this pass).
- Code editor loader stays a centred spinner (it is editor chrome; a skeleton needs its layout).
- Preferences keeps both the header Save and the SaveBar (settings step decides one pattern).
- The import drop zone keeps its dashed panel and icon tile (allow-listed in the design guard).
