# One Publish for an imported theme's code and Customize changes

The owner asked why one change to an imported theme needed Edit code → Publish and then
Customize → Save. An imported theme keeps two kinds of drafts: Edit code's unpublished files
(`theme_file.draft_body`) and Customize's template drafts (`theme_template.draft`). Each screen
only put its own live.

**Now one step does both.**
- Core `theme-code/drafts.ts`: `themeDraftCounts(tx, themeId)` → `{ templates, code }`, and
  `publishThemeDrafts(tx, storeId, { themeId, by })`, which commits every template draft
  (`commitTemplateDrafts`) and publishes every code draft (`publishCodeDrafts`) in the same
  transaction. A broken file or a template whose connected source is gone stops both. A live
  theme gets **one** version history entry for the publish (`snapshotTheme` reason `save`, only
  when templates were saved, as Customize's Save did); code files keep their per-file versions.
- API: `themes.code.counts` (read) and `themes.code.publishAll` (write, Online store write, queues
  one theme screenshot when anything changed). `themes.code.publish` and `themes.templates.commit`
  stay for the MCP and older callers.
- Edit code (`use-code-buffers`, `code-top-bar`, `theme-code-editor`): Publish calls `publishAll`.
  The bar also shows "N templates unsaved in Customize", Publish appears when only Customize has
  changes, and the confirm dialog says Customize's changes go live with the files ("Publish
  everything?"). Discard still drops only code drafts.
- Customize (`lib/use-code-drafts.ts`, `customize-editor`, `customize-top-bar`): Save calls
  `publishAll`, so files saved in Edit code go live with it. With such files waiting the bar counts
  as unsaved, the Save button's hint says "Save also publishes N files saved in Edit code", and the
  toast adds "N files from Edit code published too."
- Copy: `data/theme-code.ts`, `data/customize-inspector.ts`, Hindi in `data/hi/theme-code.ts` and
  `data/hi/themes.ts`.

Tests: `packages/core/src/theme-code/drafts.test.ts` (both kinds counted and published together,
one version entry on the live theme, none on an unpublished one, a broken file stops the templates).

`customize-editor.tsx` is at 499 lines (hard cap 500): the next change there should split it.
