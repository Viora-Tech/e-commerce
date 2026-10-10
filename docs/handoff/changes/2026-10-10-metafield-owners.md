# Extra fields on variants, customers, orders, pages, blog posts and the shop (CMS PR4)

- **Migration `0108_metafield_owners`**: widens the `metafield_definition_owner` CHECK to
  `product, variant, collection, customer, order, page, article, shop`, and grants the new
  `content.manage_types` permission to every role holding `content.write` or `settings.manage`,
  plus the system Administrator.
- **Permission** `content.manage_types` (`CONTENT_MANAGE_TYPES`) now guards content type and extra
  field definitions (create, preset, update, delete). Values follow the record's own access via
  `METAFIELD_OWNER_PERMISSIONS` (core `metaobjects/owner-permissions.ts`).
- **Core**: `METAFIELD_OWNER_TYPES`, `PRIVATE_METAFIELD_OWNERS` (customer/order never storefront),
  owner existence per table (shop = the store row), `deleteMetafieldsOf` (customer delete and
  erase).
- **API**: `metafields` / `setMetafields` take `ownerId` optional for `shop` (always the caller's
  store); `canAny` + per-owner check.
- **Admin**: `MetafieldsCard` on order, customer, page and blog post pages; `VariantMetafieldsCard`
  on the product page; Settings → Custom data has a tab per owner and the Store tab edits the
  store's own values; role editor shows "Manage types".
- Not in this PR: theme bindings for the new owners (theme/dynamic sources belong to the theme
  editor work).
