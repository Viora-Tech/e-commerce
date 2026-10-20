# Storefront: Shopify's built-in /collections/all

Imported Shopify themes link to `/collections/all` (every product), which 404'd because no
collection row has that handle. `getCollectionByHandle` (apps/storefront/src/lib/collections.ts)
now falls back to a synthetic "All products" collection (empty `id`, newest first) when the handle
is `all` and the store has no real `all` collection. The collection page browses without a
collection id for it, and the Puck collection block shows the latest products.
