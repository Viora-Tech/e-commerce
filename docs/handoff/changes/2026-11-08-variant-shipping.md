# Per-variant shipping: variant profiles and "requires shipping" (#1309)

Owner's request (8 Nov): one variant of a product in a shipping profile, the other not, as on
Shopify, plus Shopify's "This is a physical product".

- **Data** (migration `0230_variant_shipping`): `shipping_profile_variant` (store, profile,
  variant; unique on `store_id, variant_id`, RLS via `apply_store_rls()`, storefront cache
  trigger), `variant.requires_shipping` and `order_line.requires_shipping` (both default true,
  so every existing product and order is unchanged).
- **Rule** (`packages/core/src/shipping/profiles.ts`): a line ships under its variant's own
  profile, else its product's, else General (`lineProfileId`). Lines that need no shipping
  (gift cards, `requires_shipping` false) are left out of the quote with their share of the
  cart's value (`splitProfileParts`); a cart whose every line ships in one profile is measured
  on the whole cart exactly as before. A cart with nothing to ship is `not_configured`: no
  charge, no option.
- **Service** (`profiles-service.ts`): `ShippingProfileWrite.variantIds` (optional: left out
  keeps the profile's variant rows, so older callers that only send `productIds` change nothing).
  Placing a variant in a profile moves it out of another. `getShippingProfile` returns
  `variantIds` and `entries` (each product with its variants: `inProfile`, `shipsUnder`,
  `placedElsewhere`, `requiresShipping`); `profileProductEntries` reads the same for products
  just picked. `productCount` counts products with any variant in the profile.
- **Admin**: the profile page's products card (`profile-products-card.tsx`,
  `profile-product-row.tsx`, pure state in `profile-products-state.ts`) lists products with
  "All variants" / "2 of 3 variants" and opens to tick variants. "Add products" uses the shared
  `SelectProductsDialog` (variant expansion); "Add a collection's products" adds whole products.
  Saving: a product with every variant that would follow it ticked is saved whole (later
  variants join it); otherwise the ticked variants are saved one by one. The product page's
  Shipping card (no options) and the variant Edit dialog have "This is a physical product";
  off hides weight.
- **Checkout**: a cart of only no-shipping variants skips the courier (no serviceability
  check, no Delivery options app quote, no shipping charge, COD refused since no courier
  collects it) but **keeps the address**, which the GST invoice and place of supply need. The
  delivery card says "No shipping needed". `placeOrder` returns no shipping for it whatever
  the client sends.
- **Fulfilment**: no-shipping lines are still routed and reserved (stock stays right) and sit
  in their parcel, but `createShipmentForOrder`, Create shipment drafts (`prepareShipments`),
  courier order push, packing slips and pick lists leave them out (the invoice keeps them). An
  order of only such lines never lists under Shipments › To book, is marked fulfilled with
  Fulfil items and no tracking, and completes like a gift card order once paid.
- **Imports**: Shopify API `inventoryItem.requiresShipping` and the CSV's "Variant Requires
  Shipping" (blank leaves the store's value); our product CSV export writes that column.
- **API / MCP**: `products.updateVariant` takes `requiresShipping`; `products.get` returns it;
  `shipping.profiles.create/update` take `variantIds`; new `shipping.profiles.productEntries`.
  The assistant's product details name variants that need no shipping.

Not done: the Shopify store-settings import still brings a profile's products whole (its
`profileItems` variant lists are not read); custom items on drafts and order edits always
count as shipped.
