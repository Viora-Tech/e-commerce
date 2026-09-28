# Dynamic sources in the theme editor

**Dynamic sources in the theme editor** (27 September 2026, `feat/dynamic-sources`): Shopify's
"Connect dynamic source". A database button beside text, rich text, image, link, number and
colour settings opens a picker of type-compatible sources (product fields and metafields on
product templates, collection fields and metafields on collection templates, store details
and metaobject entry fields everywhere); a connected setting shows a chip with ✕. Bindings
are `{ "$source": "product.metafields.custom.material", "kind": "text", "fallback": ... }`
inside section props (no migration). Pure rules in `@commerce/core/dynamic-sources`
(`packages/core/src/dynamic-sources/`), loader under RLS in its `service.ts`; the storefront
resolves in `renderTemplate` (`sources: { productId | collectionId }`), empty sources render
the typed-in fallback. Save refuses bindings to sources that no longer exist. The vendored
product taxonomy JSON moved to `packages/core/src/catalog/` (admin imports
`@commerce/core/product-taxonomy.json`) so `product.category` can be named server side.
Developer docs: `developer-docs/building/dynamic-sources`; merchant guide: Online store.
