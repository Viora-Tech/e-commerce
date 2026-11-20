---
name: koomerce-liquid-themes
description: Work on imported Shopify (Liquid) themes in Koomerce, the storefront's liquid-theme.ts render path, the behaviour swap shim, and the Customize theme editor built on Puck. Use when a Liquid section renders wrong, a Shopify filter, tag or object is missing, theme scripts misbehave, the editor canvas or inspector needs a change, or when anyone wants to change a store's theme settings, posters or template data.
metadata:
  checked-against: "dev, 20 Nov 2026"
---

# Liquid themes and the theme editor

Guides: `apps/docs/content/developer-docs/building/shopify-theme-import.mdx` (import, engine,
render, swap table, tests) and `apps/docs/content/developer-docs/building/theme-editor.mdx`
(Customize). Owner rule for imported themes: copy the look exactly, run every function on our
own features, and say in plain words what changed.

## The one rule about theme data

A store's theme settings, section settings, template JSON, images and video posters are the
merchant's content, stored in the database (`theme_template`, `theme_file`, `theme_import`).
**Change them only through the theme editor (Online Store, Themes, Customize)**, never with SQL,
a script or a migration against a live or test store.

- Agents working for the owner set the value in Customize and leave it as an unsaved change for
  the owner to Save, or apply it first to the local store's theme for the owner to check, then to
  production as an unpublished draft.
- A code fix may change how a value is read or drawn (for example reading `data-poster` as well
  as `poster`), but not rewrite the saved value.
- Video posters: the Themes page picture (`apps/admin/src/lib/capture-theme-thumbnail.ts`) reads
  the saved home page; posters are chosen in the editor's media fields.

## Where the code is

| Area | Path |
| --- | --- |
| Import, engine, drops, filters, render (server) | `packages/core/src/theme-import/` (`index.ts`; browser half `client.ts` as `@commerce/core/theme-import`) |
| Zip reader, size caps | `theme-import/archive.ts` |
| LiquidJS engine, Shopify tags, limits | `theme-import/engine.ts`, `filters.ts`, `filter-values.ts` |
| Shopify objects on our data | `theme-import/resource-drops.ts`, `drops.ts`, `data.ts`, `custom-drops.ts` |
| Section and layout render | `theme-import/render.ts`, `bundle.ts`, `bundle-store.ts` |
| Swap table (Shopify feature to ours) | `theme-import/swap.ts` (`SWAP_TABLE`) |
| Storefront render path | `apps/storefront/src/lib/liquid-theme.ts` |
| Theme JS calls to Shopify, rerouted | `apps/storefront/src/lib/liquid-shim.ts` |
| Theme scripts wait for React | `apps/storefront/src/lib/liquid-defer.ts`, `components/theme/liquid-boot.tsx` |
| Checkout never themed | `apps/storefront/src/lib/checkout-path.ts` |
| Customize editor | `apps/admin/src/components/themes/customize/` (copy `apps/admin/src/data/customize.ts`) |
| Liquid schema to Puck fields | `apps/admin/src/lib/use-liquid-theme.ts`, `customize-liquid-blocks.ts`, `customize-liquid-metadata.tsx` |
| Puck document shape | `apps/admin/src/lib/customize-doc.ts` (header and footer as root zones) |
| Our own sections (Zero Drift port) | `packages/blocks/src/sections/`, inline fields `inline-fields.ts` |

Puck is `@puckeditor/core` 0.23 (MIT). Every editor change is a Puck action, so undo stays one
history; tests mock `useCustomizePuck` rather than mounting Puck.

## How a request renders

1. The request's theme (live, or a verified preview) has a `theme_import` row, so
   `liquid-theme.ts` renders each `LiquidSection` (from the render cache or fresh) inside
   Shopify's own wrapper ids (`shopify-section-template--...`), because themes key CSS on them.
2. The layout draws the theme's `layout/theme.liquid` head and shell, with the CSP nonce on
   every theme script. Our pages (product, cart, search, account) render inside the theme's
   header and footer; `/checkout/*` never does.
3. Theme `defer`/`async`/module scripts are parked and booted after hydration.
4. Calls the theme JS makes to Shopify (`/cart/add.js`, `/cart.js`, `?section_id=`,
   `/search/suggest`, `/recommendations/products`, forms) go to our routes (`/theme-actions/*`).

## What works and what does not (yet)

Works: sections, theme blocks, snippets, section groups, home/product/collection/page templates
with alternates, metafields and metaobjects as our extra fields and content types, markets and
`localization`, customer and orders, cart and predictive search through the shim, Reviews app
data in Shopify's and Judge.me's shapes, Forms app for contact forms.

Not yet (from the guide's "Not yet"): resource templates beyond our own main sections, editing
`settings_schema.json` in Customize, adding new theme sections from the Add panel, an in-place
cart drawer refresh. App blocks (`@app`) are left out and listed in the import report.

## Adding support for a Shopify feature

1. Find the gap in the import report reason or the swap table (`swap.ts`).
2. Add the filter, tag or drop in `theme-import/` (pure where possible; synchronous render passes
   read from the per-request cache in `cache.ts`).
3. Report wording (English and Hindi) lives in `apps/admin/src/data/theme-import.ts`.
4. Test on the fixture theme, never on a real store or the network.

## Tests

```sh
cd packages/core && bunx vitest run src/theme-import/engine.test.ts   # no database
cd packages/core && bunx vitest run src/theme-import/import.test.ts   # database, fake fetch
cd apps/storefront && bunx vitest run src/lib/liquid-shim.test.ts src/lib/liquid-defer.test.ts
cd apps/admin && bunx vitest run src/components/themes/customize
```

Fixture: `packages/core/test/theme-import-fixture.ts`. The `theme-css-fence` sweep keeps our
theme CSS off imported sections (`docs/guardrails.md`, sweep x). The core suite's global setup
needs the test Postgres even for `engine.test.ts`.
