# Shopify theme import: upload a theme zip, keep the look, run on our features

Branch `feat/shopify-theme-import`. Migration **0085_shopify_theme_import** (`theme_file`,
`theme_import`, RLS via `apply_store_rls()`; written with `IF NOT EXISTS` / guarded `DO` blocks
because the shared dev database ran this branch's earlier 0081 of the same tables). Chained after
0084_gst_phase_2_3.

## What merchants get

- Online Store → Themes → **Import Shopify theme**: licence notice ("only upload themes you own…"),
  the zip Shopify emails, the old store's address (to copy pictures and hero videos), a rights
  checkbox. Always a **new** unpublished "<name> (imported)" theme; the live theme never changes.
- **Import report** page (`/online-store/themes/<id>/import`, English + Hindi): counts per status,
  "Before you publish" (missing menus / collections / products / blogs, pictures or videos not
  copied), the swap table for this theme, every section with its result and reason, pages that use
  the theme vs ours. Linked from the theme library row ("Imported" badge).
- Customize on an imported theme: sections named after their schema, fields generated from each
  `{% schema %}` (blocks as cards with their own type's fields, colour schemes as a select), the
  canvas drawing the theme's real HTML and CSS (scripts stripped). Reorder / hide / duplicate /
  delete work; the right panel says theme settings come from the Shopify theme.
- Storefront: home page, header and footer render the theme's own Liquid; product, collection,
  cart, search and account pages are ours inside the theme's header and footer.

## Where the code lives

- `packages/core/src/theme-import/` — the one owner module: `archive` (zip), `schema`, `fields`
  (Puck shape + editor fields, browser safe via `@commerce/core/theme-import`), `engine` (LiquidJS +
  Shopify tags), `filters` / `filter-values`, `drops` / `resource-drops` / `page-context` (Shopify
  objects on our data), `cache` (sync data passes), `bundle` / `bundle-store` (files, cached per
  version), `render`, `settings-values`, `data` (DB loader), `import` / `import-media` /
  `import-report`, `report`, `swap` (the swap table), `numeric-id` (Shopify-style whole-number ids).
- API: `themes.import.{shopify,report,editor,render}` (`packages/api/src/routers/themes.ts`,
  `services/theme-import.service.ts`); `themes.list/get` carry `imported`.
- Blocks: `LiquidSection` (`packages/blocks/src/sections/liquid.tsx`), `SectionMetadata.liquid`.
- Storefront: `lib/liquid-theme.ts`, `lib/liquid-shim.ts` (behaviour swap),
  `components/theme/liquid-html.tsx`, routes `theme-assets/[themeId]/[file]` and
  `theme-actions/[action]`, proxy derives `x-pathname` and `x-form-posted`.
- Admin: `import-theme-dialog`, `import-report-*`, `customize/liquid-canvas-section`,
  `customize/imported-theme-settings`, `lib/use-liquid-theme`, `lib/liquid-canvas`,
  `lib/customize-liquid-blocks`, `data/theme-import.ts` + `data/hi/theme-import.ts`.
- Docs: merchant guide "Import a Shopify theme", developer docs "Shopify theme import and the
  Liquid engine" (swap table, engine, renders).

## Zero Drift (the owner's theme) on the dev data

Imported through the admin UI with `waimers.in`: 20 pictures and 8 hero/bento videos copied.
Home + header + footer (26 sections): 14 imported exactly, 8 run on our features, 4 not available
yet (reviews showcase reads Judge.me data, reviews app block, drops teaser and signup popup read
metafields), 0 failed. Whole theme (114 sections): 51 / 40 / 21 / 0. Every section and snippet
parses. Visually matches waimers.in section by section at 1440×900 and 390×844; remaining
differences are data (no `new-nav-1` menu, no `preorder` / `best-sellers` collections, two
products, our stock and pre-order flags), Judge.me reviews, and the money format (₹7,499 from
`@commerce/money` vs "Rs. 7,499.00").

## Left for later

- Resource templates (product, collection…) from the theme; theme settings editing; adding
  theme sections from the Add panel.
- Cart drawer refreshing in place, predictive search in the theme's look, contact form messages.
- Optional store `money_format` so imported themes can print prices the Shopify way.

## Local notes

- Visual checks used a private copy of the dev database (`commerce_themeimport_dev`) after this
  branch's migration ran on the shared one before 0084; never run this branch's migrations on the
  shared dev DB again before it merges.
- `packages/blocks` `glide-footer-group.test.tsx` (SignupPopup "open while editing", 3 tests) fails
  on main as well (`usePuck must be used inside <Puck>` from `editor-overlay.tsx`); not this PR.
