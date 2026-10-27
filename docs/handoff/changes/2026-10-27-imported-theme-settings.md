# Theme settings for imported Shopify themes (favicon, colours, fonts…)

Customize → Theme settings on an imported theme used to show a note only. It now lists the
theme's own `config/settings_schema.json` groups (Logo, Colors, Typography, Cart, Social media…)
as rows like our ThemePanel (icon, name, one-line summary, chevron); a row opens its settings
with editors by setting type: `image_picker` → media picker, `color` → swatch,
`color_scheme_group` → one collapsible per scheme, `font_picker` → the store's curated typefaces
(same weight/style, the theme's current font kept first), the rest → the field Customize's
section inspector already gives that type (`settingField` in `fields.ts`, now exported).

- **Where values live:** `theme_import.settings` (imported from `settings_data.json`), what the
  renderer reads as `settings.*`. `themes.import.saveSettings` → `saveImportedThemeSettings`
  (`packages/core/src/theme-import/theme-settings-store.ts`) keeps only ids the schema declares,
  cleans each by type (`cleanThemeSetting` in `theme-settings.ts`: options must exist, colours
  hex, image/URL addresses http(s) or a path, ranges clamped), merges over the record, moves
  `updatedAt` (bundle cache + storefront cache invalidate) and touches the theme. The theme's
  `config/settings_data.json` file is not rewritten (it stays import-only in Edit code).
- **Save flow:** edits are part of Customize's top-bar Save / Discard / dirty state
  (`useImportedThemeSettings`). Before Save the canvas previews them: `themes.import.render`
  takes optional `themeSettings`, and the new `themes.import.head` re-renders the theme head
  (CSS variables, fonts). Settings saves are not in Version history.
- **Favicon:** the theme head is rendered inside `<body>` on the storefront, where browsers
  ignore `<link rel="icon">`. `renderLiquidLayout` now returns `favicon` (first icon link of the
  theme head, `headFavicon`), and the storefront layout writes it in `<head>` (falling back to
  `theme.brand.favicon`).
- Not done: `video`/`metaobject` theme settings have no editor (left to Edit code); the
  `font_picker` offers our 16 typefaces, not Shopify's whole font library.

Tests: `packages/core/src/theme-import/theme-settings.test.ts`, `theme-settings-store.test.ts`,
`packages/api/test/theme-import-settings.test.ts`, `apps/admin/src/lib/imported-theme-settings.test.ts`.
