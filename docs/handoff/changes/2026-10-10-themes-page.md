# Themes page to Figma, real thumbnails, last saved by

Branch `feat/themes-page`. Online Store → Themes rebuilt against Figma "Online store / Themes"
(309:19887, menu open 405:120973, light and dark).

- Page: Proofly body and header (Bricolage 32 title, 15px summary), Import Shopify theme (plain)
  and Add theme (key) actions, Themes/Preferences segmented tabs to the Figma spec (also on
  Preferences). New `loading.tsx` skeleton in the page's shape.
- Live theme card: 420 × 260 picture well, name with Live / Imported / Unsaved changes chips,
  "Current theme · last saved … by …", "N sections ready to use…", Preview, Customize (key) and a
  key kebab whose menu starts with Customize (Figma). "Edit code" from the Figma menu is not
  built (there is no code editor).
- Library rows: home page picture (theme colours until there is one), Imported and Unsaved
  changes chips, "Last saved … by …", import report link, kebab, Publish, Customize. Empty state
  as in Figma. No filters: Figma shows none.
- Thumbnails: taken in the browser from Customize's same-origin canvas with modern-screenshot
  (already a dependency), no headless browser. On Save of the home page, and once when a theme
  without a picture is opened. `themes.thumbnail` validates WebP ≤ 256 KB, stores one object per
  theme via the store's storage provider. Typical size 6–40 KB.
- Data: migration `0097_theme_thumbnail` adds `theme.thumbnail_url` and `theme.updated_by`
  (both nullable, no backfill). `templates.commit` now bumps the theme's `updated_at`.
- API: `themes.list/get` return `hasDraft` and `sectionCount` too; `themes.thumbnail` is new.
- Tests (not run, per the owner's rule): `packages/api/test/theme-thumbnail.test.ts`, a new case
  in `packages/core/src/theme/library.test.ts`.
- Docs: developer docs Theme editor → "Themes page" and "Thumbnails"; merchant guide Online store.
