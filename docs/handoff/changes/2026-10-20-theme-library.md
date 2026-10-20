# Themes: preset themes skip imported Shopify sections; static previews on the Themes page

Branch `fix/theme-library`. No migration.

- **New theme from a preset** (`createThemeFromPreset`, `packages/core/src/theme/library.ts`) still
  copies the live theme's templates, but `copyTemplates(..., { withoutLiquid: true })` now drops
  `LiquidSection` entries (an imported theme's own sections, whose Liquid lives only in that
  theme's files). A template left with nothing visible becomes our `defaultTemplate(key)`. Before,
  a preset theme made while an imported theme was live rendered a blank canvas. The pure helper
  is `withoutLiquidSections` in `templates-data.ts` (unit tests in `templates-data.test.ts`).
- **Duplicate** is unchanged: it copies the templates and the import files (`copyThemeImport`),
  so a copy of an imported theme keeps every section. Covered in `library.test.ts` (needs Postgres).
- **Themes page**: the current theme card (`theme-preview-stage.tsx`) no longer embeds two live
  storefront iframes. Desktop and phone frames show the saved home page picture
  (`theme.thumbnailUrl`, taken on Save in Customize) or, before the first one, the theme's
  `ThemeSwatch`. The live storefront opens only from Preview or Customize.
