# Imported themes read metafields and metaobjects (#275)

- Imported Shopify themes now read custom data instead of rendering blank:
  `product.metafields.<ns>.<key>` and `collection.metafields…` come from our extra fields,
  `metaobjects.<type>` / `shop.metaobjects.<type>` (`.values`, `[handle]`, fields, `system`) from
  content types and entries. Every field type maps to Shopify's `.value` shape (files as images,
  references as product/collection/page/variant/post/entry drops, lists as arrays, rich text as
  HTML, money/rating/measurement/link as objects) and `.type` uses Shopify's type names.
- Keys and namespaces are matched through `keyFromName`, the function the importer stored them
  with, so `custom['size-guide']` finds `custom.size_guide`.
- Loads are batched per render pass through `LiquidDataCache` (one query per owner type, one per
  content type, entry links three levels deep); only storefront-visible types, active entries and
  published targets show.
- Menu links now carry `link.object` (collection, product, page or blog of the path).
- Import report: the metafields row is "replaced" ("Read from your extra fields and content
  types"); app namespaces (Judge.me, Yotpo…) stay "not available".
- Not yet: extra fields on variants, pages, blog posts, blogs, customers and the shop (no owner
  type in `metafield_definition`; the importer only counts them). No migration.
- Code: `packages/core/src/theme-import/custom-data.ts`, `custom-drops.ts`; tests
  `custom-drops.test.ts` (no database) and `custom-data.test.ts` (test database).
