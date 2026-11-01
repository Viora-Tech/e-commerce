# Shipping profiles (product-based rates)

Audit #159: Waimers' skates shipped free because Koomerce had one rate set for every product
(Shopify has General, Skates: Delhivery ₹99 / Bluedart ₹139, Switches).

- **Data** (migration `0193_shipping_profiles`): `shipping_profile` (one `is_default` General per
  store), `shipping_profile_product` (a product in at most one custom profile), and
  `shipping_zone.profile_id`. The migration gives every store a General profile and moves its
  zones into it, so nothing changes at checkout. A zone with no profile (seeds, older code)
  counts as General; `ensureGeneralProfile` makes General for stores created later. RLS via
  `apply_store_rls()`; both tables invalidate the storefront cache.
- **Checkout rule** (`packages/core/src/shipping/profiles.ts`, `quoteProfiles`): lines split by
  profile; each profile is quoted on its own lines (value after discounts shared by subtotal,
  weight) against its own zones. One profile in the cart: unchanged. Several: one rate per
  profile, summed; options are "cheapest of each" plus one per rate name (that name wherever it
  exists, cheapest elsewhere). Joined rate ids use `+`; `order.shipping_rate_id` keeps the first
  part, `order.shipping.profiles` keeps every part. A profile without a rate for the address
  blocks checkout; only a store with no zones at all ships free.
- **Cart line**: "free above ₹X" now only shows when every profile in the cart promises it.
- **Admin**: Settings › Shipping lists profiles (General first, product counts, prices);
  `/settings/shipping/profiles/[id]` and `/new` manage name, products (Browse picker, or a
  collection's products) and the profile's delivery areas. New zones take `?profile=`.
- **API**: `shipping.profiles.{list,get,create,update,delete,collectionProducts}`.
- **Shopify import** (Store settings › Shipping): reads every profile's zones and a custom
  profile's products (`profileItems`), creates/updates the profile with the products the
  products import brought over (mapping `settings_shipping_profiles`), warns
  `profile_products_missing` for the rest, and puts its zones inside it.
