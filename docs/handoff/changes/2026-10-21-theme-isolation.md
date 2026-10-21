# Themes: sections stay with their theme; "Start from scratch" makes a blank theme

Branch `fix/theme-isolation`. No migration (everything lives in existing jsonb columns).

## 1. My sections that hold Liquid belong to one theme

- A saved section (`store.preferences.customSections`) that contains a `LiquidSection` anywhere in
  its tree now records `themeId`, the theme it was saved from (`saveCustomSection`, from the
  editor's `useEditingThemeId()`). Sections built only from our own blocks get no `themeId` and
  stay available in every theme.
- Rule, in `customSectionsForTheme` (`packages/core/src/theme/custom-sections.ts`), used by
  `api.themes.customSections.list({ themeId })`:
  - no Liquid: every theme;
  - Liquid with `themeId`: only that theme;
  - Liquid without `themeId` (saved before this change, theme unknown): only imported themes (a
    `theme_import` row), since our own themes cannot render Liquid. Hidden in native themes.
- Admin: `customize-my-sections.ts` keeps one list per edited theme; the theme id reaches the
  Add panel and the Save dialog through `EditingThemeIdContext`, provided by
  `ThemePacksProvider` on the editor page.

## 2. Section packs are per theme

- Each theme keeps its own list in `theme.settings.themePacks` (beside the settings, not part of
  `ThemeSchema`; `updateThemeSettings` carries it over, so a settings save never drops it).
  Helpers: `parseOwnThemePacks`, `effectiveThemePacks`, `withOwnThemePacks` (`theme-packs.ts`);
  `themePacksOf`, `saveThemePacks(tx, themeId, packs)` (`library.ts`).
- **Backward compatibility**: a theme with no own list (every theme made before this change)
  follows the store-level `store.apps.settings.core.themePacks`, so Waimers' live theme keeps
  Zero Drift with no data change. New themes start with their own list: preset and blank themes
  and imports with `[]`, a duplicate with its source's effective packs.
- API: themes from `list`/`get`/`create`/... carry `packs` (effective). `themes.packs({ id })`
  and `themes.setPacks({ id, packs })` (still `settings:manage`) are per theme now.
- UI: kept on Online store › Themes, "Section packs" card, now one switch per theme (the smaller
  change: no new editor panel, and the editor builds its Puck config once at mount, so a toggle
  inside Customize would only apply after a reload anyway). Customize reads `theme.packs`.
- Seed: unchanged data; the Waimers store-level flag is the fallback its seeded live theme uses.

## 3. Add theme › "Start from scratch"

- Menu item and a dialog choice. `api.themes.createBlank({ name })` → `createBlankTheme`: the
  Minimal preset's settings (keeping the live theme's logo and favicon), no packs, and stored rows
  for `header` (only the Header), `footer` (only the Footer) and `home` (empty), from
  `blankTemplate` / `BLANK_THEME_TEMPLATES` (`templates-data.ts`). Every other template has no row and
  renders its code default, which is just its main section. Nothing is copied from the live
  theme. Copy in `data/themes.ts` (`library.startBlank`, `addDialog.blank*`), Hindi in
  `data/hi/themes.ts` (the add dialog now has a Hindi overlay too).

## Tests

Pure: `theme-packs.test.ts`, `custom-sections.test.ts`, `templates-data.test.ts` (core).
DB-backed (not run in this PR's session, Postgres was down): `library.test.ts` (blank theme,
packs per theme), `packages/api/test/theme-packs.test.ts` (rewritten for the per-theme API).
