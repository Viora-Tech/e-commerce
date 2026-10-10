# Theme version history

Branch `feat/theme-versions` (plan F3).

- Migration `0103_theme_versions` (after dev's 0102; RLS via `apply_store_rls()`): table
  `theme_version` (theme, batch, reason `publish`/`save`, template, suffix, sections, created by).
- Snapshots: `themes.publish` (when the theme was not live) and `themes.templates.commit` on the
  live theme (the editor's Publish on a live theme). The newest 20 per template are kept.
- Themes page: ⋯ → **Versions** (`theme-versions-dialog.tsx`): list, Preview, Restore (into
  drafts; never goes live by itself; the theme then shows "Unsaved changes").
- Storefront: `?theme-version=<batch>` on a preview link renders that version (proxy header
  `x-theme-version`, preview only, uuid only, derived header stripped from requests).
- Core: `packages/core/src/theme/versions.ts`; API: `themes.versions.list/restore`.
- Browser-checked on a duplicated theme (in my own DB copy, live state restored afterwards):
  publish → version, publish changes → version, previews of each version show their own page,
  Restore put the older page into the drafts and left the saved page alone.
- Tests (not run): `packages/core/src/theme/versions.test.ts` (batches, retention, restore,
  RLS); leak test maps the `themes.versions` namespace.
- Note: a version preview applies to the opened page only; links inside it show the theme's
  current drafts.
