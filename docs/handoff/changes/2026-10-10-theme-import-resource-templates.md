# Theme import: product, collection and page templates

Branch `feat/theme-import-templates`. Follows the #280 finding (imported themes rendered only
home, header and footer).

- `importShopifyTheme` now also turns `templates/product.json`, `collection.json` and
  `page.json`, with their alternates (`page.about.json` → page template `about`), into our
  templates (`importedPages` in `packages/core/src/theme-import/import.ts`). Alternates whose
  suffix our templates cannot hold are skipped.
- The theme's first main section (`main-product`, `main-collection…`, `main-page`) becomes our
  own (`MainProduct`, `MainCollection`, `MainPage`); further main sections are dropped. A product
  or collection template with no main section gets ours first.
- The Liquid page context loads Shopify's `product`, `collection` or `page` global from the path
  (`resourceGlobals` / `resourceHandle` in `page-context.ts`), so specs, size guides and related
  products read the page's resource.
- Report: `IMPORTED_TEMPLATES` is `index`, `product`, `collection`, `page` (alternates count with
  their base, `isImportedTemplate`); the "imported pages" counts include them; the admin report
  names alternates "Pages: about" and its copy (English and Hindi) says which pages are the
  theme's.
- Only new imports change: a theme imported before this keeps its templates (import it again).
- Tests written (not run, owner rule): `import-pages.test.ts` (pure), two cases in
  `import.test.ts`, and the fixture report expectation.
- Docs: merchant guide "Import a Shopify theme", developer "Shopify theme import" (Templates row).
