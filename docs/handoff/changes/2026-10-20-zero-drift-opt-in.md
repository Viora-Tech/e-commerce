# Theme editor: Zero Drift sections are opt-in per store; new stores start neutral

Branch `fix/zero-drift-opt-in`. No migration.

Zero Drift is the Waimers store's own Shopify theme rebuilt as React sections. It is now a
**theme pack** a store opts into, instead of the first group every store's Add menu showed.

- **Flag**: `store.apps.settings.core.themePacks` (a string array, beside the core tax switches in
  the same `store.apps` jsonb), so no migration. Read by `parseThemePacks`
  (`packages/core/src/theme/theme-packs.ts`) and `storeThemePacks(tx, storeId)` (`library.ts`);
  exposed as `api.themes.packs` (ONLINE_STORE_READ). The only pack is `zero-drift`.
- **Add menu**: `SECTION_CATEGORIES` and the new `sectionCategories(themePacks)` /
  `hiddenPackSections(themePacks)` live in `packages/blocks/src/section-categories.ts` (re-exported
  from `@commerce/blocks/puck`). Our groups come first (Banners, Text, Products, Media, More,
  Layout, Elements); the "Zero Drift theme" group comes last and only with the pack on. Without the
  pack, the Zero Drift product sections leave Products, and the phone dock / signup popups leave the
  footer group's list. `createBlocksConfig` takes `options.themePacks` for `categories`; every
  section stays registered, so saved pages that use Zero Drift sections still render and edit for
  any store. The admin editor page reads `themes.packs` on the server and hands it down through
  `ThemePacksProvider` / `useThemePacks` (`customize-theme-context.ts`).
- **New stores**: `defaultTemplate` (header, home, footer) now uses only generic sections with
  neutral copy set on each section (`packages/core/src/theme/data/default-templates.ts`), because
  several generic sections' block defaults are still Zero Drift's Waimers copy (left unchanged:
  stored `{ id }`-only rows rely on them). The footer no longer starts with the phone dock or the
  three signup popups. Merchant signup (`createStore`) now makes the main theme from the
  **Minimal** preset (`ensureMainTheme(tx, storeId, 'minimal')`); existing stores are untouched.
- **Dev seed**: the Waimers seed store gets `themePacks: ['zero-drift']`.

## Turning it on for Waimers

**Admin:** Online store › Themes › "Section packs" card › "Zero Drift sections" switch. Shown to
owners and administrators only (`settings:manage`). It calls `api.themes.setPacks({ packs })`
(`saveThemePacks` in `library.ts`), which rewrites only `settings.core.themePacks` and keeps the
rest of `store.apps`. Tested in `packages/api/test/theme-packs.test.ts` (round trip, unknown pack
refused, staff refused). Copy in `data/themes.ts` (`packs`) with Hindi in `data/hi/themes.ts`.

**Or SQL**, if the admin is not reachable:

```sql
UPDATE store SET apps = jsonb_set(jsonb_set(jsonb_set(coalesce(apps, '{"installed":[]}'::jsonb), '{settings}', coalesce(apps->'settings', '{}'::jsonb)), '{settings,core}', coalesce(apps#>'{settings,core}', '{}'::jsonb)), '{settings,core,themePacks}', '["zero-drift"]'::jsonb) WHERE slug = 'waimers';
```

Keeps installed apps and the tax switches; check with
`SELECT apps#>'{settings,core}' FROM store WHERE slug = 'waimers';`. Customize picks it up on the
next editor load. To turn it off, set `themePacks` to `'[]'`.

## Left as is

- Generic sections whose block defaults are Waimers copy (Announcement bar, Hero carousel, Email
  signup, Footer, Header cards) still insert with that copy when added from the menu. Changing
  those defaults would change stores whose saved rows rely on them; a follow-up can move those
  defaults to neutral copy with a data backfill.
- A store that never saved a header/home/footer row now renders the new neutral defaults. Waimers
  should have saved rows; to confirm, `SELECT t.template FROM theme_template t JOIN theme th ON
  th.id = t.theme_id JOIN store s ON s.id = th.store_id WHERE s.slug = 'waimers' AND th.role =
  'main' AND t.template IN ('header','home','footer');` should list all three.
