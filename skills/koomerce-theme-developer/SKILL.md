---
name: koomerce-theme-developer
description: Move a Shopify Online Store 2.0 (Liquid) theme to Koomerce or build sections for it - what the theme importer and Liquid engine support, what Shopify features are swapped for Koomerce ones, what does not work yet, and how to test a theme safely. Use when preparing a Shopify theme zip for import, debugging a section that renders differently after import, editing an imported theme in Customize, or writing native Koomerce sections.
license: MIT
compatibility: For Koomerce stores (Online Store, Themes) and the Koomerce monorepo (github.com/Viora-Tech/e-commerce).
metadata:
  author: Viora-Tech
  koomerce-version: "Koomerce platform, November 2026"
  version: "1.0"
---

# Koomerce theme developer

Koomerce runs two kinds of theme:

- **Imported Shopify themes**: the zip Shopify emails ("Download theme file"), uploaded in
  Online Store, Themes, Import Shopify theme. It becomes a new **unpublished** theme
  "<name> (imported)"; the live theme is never touched. The look is copied exactly; every feature
  runs on Koomerce's own cart, search, accounts and checkout.
- **Native themes**: sections built as React and Puck blocks, edited in the same Customize editor.

Developer docs in the repo: `apps/docs/content/developer-docs/building/shopify-theme-import.mdx`
and `theme-editor.mdx`. Support details: [references/liquid-support.md](references/liquid-support.md).

## Before you import

- Use an Online Store 2.0 theme (JSON templates, `{% schema %}` sections, section groups).
- Size caps: 50 MB zip, 120 MB unpacked, 15 MB per file, 4,000 files. Paths with `..`, absolute
  paths or drive letters are dropped. Nothing in the zip is executed at import.
- Images under `shopify://shop_images` and Shopify Files videos are copied into the store's Files
  (at most 300 images and 20 videos per import); the rest is listed in the report.
- Run the Shopify importer app first if you can: images and videos it already copied are reused.

## After the import: read the report

Every section gets a status: **imported** (renders as is), **replaced** (a Koomerce feature
stands in, for example the product buy box), **unavailable** (it needs something the store lacks:
a menu, collection, product or blog), or **unsupported**. The report also lists app blocks that
were left out, missing handles, and files not copied. Fix what it names before publishing.

## What changes on purpose

- **Checkout is never themed.** `/checkout` and below drop the theme's CSS, scripts, header and
  footer.
- Main product, collection and page sections become Koomerce's own (`MainProduct`,
  `MainCollection`, `MainPage`); the theme's other sections around them still render.
- Theme JavaScript runs for the look (sliders, reveals, marquees), but its calls to Shopify
  (cart AJAX, section rendering, predictive search, recommendations, newsletter and contact
  forms, the cookie banner) are answered by Koomerce routes.
- Theme scripts with `defer`, `async` or `type="module"` start after the page hydrates, in
  document order.
- Shopify app blocks (`@app`) are left out. Reviews (Shopify `reviews.*` and Judge.me
  metafields) and contact forms work when the store installs Koomerce's Reviews and Forms apps.

## Not supported yet

- Product, collection and other resource templates from the theme beyond the main section.
- Editing the theme's global settings (`settings_schema.json`) in Customize, and adding the
  theme's own sections from the Add panel.
- A cart drawer that refreshes in place; predictive search results in the theme's look.

## Editing safely

- Change a theme's settings, sections, images and video posters **only in Customize**. Never edit
  the stored theme data directly (database, scripts). Customize keeps autosaved drafts and a
  version history, so an unwanted change can be rolled back.
- Work on an unpublished copy. Preview it, then publish.
- Our own stylesheets never style imported sections, and imported CSS keys on Shopify-shaped
  section ids (`shopify-section-template--...`), which Koomerce keeps.

## How to test a theme

1. Import into a test store (or the local dev store), not the live one.
2. Read the import report; fix missing menus, collections and products in the admin.
3. Preview the unpublished theme on: home, a product with variants, a collection with filters,
   search, cart, account pages, and a page template alternate.
4. Check on a phone viewport: sticky bars, drawers, video heroes.
5. Add to cart from the theme's own forms and check the cart count updates; walk to checkout
   and confirm it shows Koomerce's checkout.
6. Contributors changing the engine run the fixture tests in the repo (no network, no real
   theme): `packages/core/src/theme-import/engine.test.ts` and `import.test.ts`, plus the
   storefront's `src/lib/liquid-*.test.ts`.

## Native sections

Write them in `packages/blocks/src/sections/` with Puck fields; text shown on the canvas uses
the inline field helpers (`inlineText`, `inlineTextarea`, `inlineRichtext`) so merchants edit it
in place. Follow the repo's conventions: one component per file, copy in data files, rem sizes,
Tailwind for new code (the Zero Drift theme port's BEM stylesheets are the one exception).
