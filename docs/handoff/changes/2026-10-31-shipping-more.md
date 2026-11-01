# Shipping: international zones, boxes, local delivery and pickup, templates

Branch `agent/shipping-more`, pushed to `dev` finding by finding. Not run here (owner rule):
tsc, vitest, lint, builds. Run them on `dev`.

## #160 International zones

- **Zones have countries** (`shipping_zone.country_codes`, the column Markets added; no
  migration). `['IN']` is a zone as it always was; other ISO codes ship abroad; `*` is "Rest of
  world". Engine (`packages/core/src/shipping/rates.ts`, `zoneScore`): an address abroad
  (`ShippingDestination.countryCode`) matches a zone naming its country (1), else Rest of world
  (0); states and PIN rules never apply abroad. In India nothing changed: Indian zones score as
  before, and a Rest of world zone without India covers India only below every Indian zone (-1).
  The cart's "free above ₹X" promise counts India zones only.
- **Service** writes the countries and drops states/PIN rules from a zone without India; a
  caller passing no countries means India (`ShippingZoneSave`).
- **Admin**: the zone page has a **Countries** card (the Markets country picker plus a Rest of
  world tick); the States and PIN code cards show only when India is ticked. The zone list says
  "Karnataka · United Arab Emirates, Australia".
- **Importer**: Shopify zones abroad come over as country zones with their rates
  (`zoneCoverage`); `zone_outside_india` and `zone_other_countries` are no longer raised (kept
  for old history). Rates in another currency are still `rate_currency`.
- **Checkout**: `placeOrder` passes `checkout.address.countryCode` to the quote.
  **Not done**: the storefront checkout form is still India-only (PIN code first, Indian states,
  courier estimate by PIN code), so no shopper can enter an address abroad yet. That needs a
  country field, a foreign postcode/region form, skipping the PIN check and courier estimate
  abroad. The engine and `placeOrder` are ready for it.

## #162 Packages

- Settings › Shipping › **Packages** (the "Your boxes" card, renamed) already held named boxes
  with size, weight, cost and a main box. Added a **Type** (`kind`: box, envelope, soft package;
  `BoxPresetSchema`, default `box`, so saved boxes read as boxes). An envelope keeps 1 cm height.
- Shopify import: Admin API 2026-10 still has no query that lists saved packages (only
  update/delete/make-default mutations and a write-only `shippingPackageId`), so
  `packages_not_shared` stays; its copy now points at Packages.

## #163 Local delivery, pickup in store, split shipping

- **Data** (migration `0205_local_delivery_pickup`): `location.local_delivery` and
  `location.store_pickup` (JSONB, null = not offered). Types `LocationLocalDelivery`,
  `LocationStorePickup`; the order snapshot gains `shipping.local` (`OrderLocalDelivery`).
- **Rule** (`packages/core/src/shipping/local-options.ts`, pure, tested): local delivery for an
  Indian address whose PIN code matches the location's list (exact or prefix `*`), from its
  minimum order, free from its free-above value; pickup for every Indian address, free. Options
  come after the zone rates (`withLocalOptions`), alone when no zone covers the address; a store
  with no zones stays "free shipping". Rate ids `local:<location>` / `pickup:<location>`; the
  order's `shipping_rate_id` stays null (`rateRowId`).
- **Quote**: `quoteProfileLines` adds them, so the checkout preview and `placeOrder` price the
  same options. The storefront card shows the instructions/pickup time instead of a date.
- **Admin**: a location page has **Local delivery** and **Pickup in store** cards
  (`businessGst.setLocationLocalDelivery` / `setLocationStorePickup`).
- **Split shipping**: routing already splits an order across locations up to
  `shipping.routing.maxParcels`, and fulfilment handles several shipments per order. The new
  switch on Settings › Shipping only moves that limit: off = 1, on = 2 (Locations sets more).
- **Not done**: a radius around the location (needs geocoding; PIN code lists only); pickup and
  local delivery are not offered while the Delivery options app quotes checkout; checkout still
  asks for a delivery address with pickup, and the courier PIN check can still hide all options
  for a PIN the courier does not serve; Create shipment does not skip these orders (fulfil them
  by hand).

## #164 Printed documents (templates)

- **Data** (migration `0207_document_templates`): `document_template` (one row per store and
  kind `packing_slip` | `pick_list` | `invoice`; no row = the default). RLS via
  `apply_store_rls()`.
- **Templates** (`packages/core/src/documents/templates.ts`, pure, tested; client subpath
  `@commerce/core/document-templates`): Mustache-style merge tags (`{{ x }}` escaped, `{{#x}}`
  list/if, `{{^x}}` if empty; no raw tag), defaults for each kind, data builders
  (`packingSlipData`, `pickListData` adds up items across orders by SKU), `printDocument` (one
  page each), and a made-up `SAMPLE_ORDER` for the preview. Amounts use the store currency via
  `@commerce/money`.
- **Service/API**: `documents.{templates,get,save,reset}` (read: `orders.read`; write:
  `settings.manage`). `documentStore` prints the store header from Settings › Store details.
- **Admin**: Settings › **Printed documents** (`/settings/templates`, `/settings/templates/[kind]`):
  HTML editor, merge tag list, live preview (sandboxed iframe, scripts off), Save bar, Reset to
  default. Orders › More actions: **Print packing slips** (now the template), **Print pick list**,
  **Print invoices**; the order page's Print opens the same view. The old `PackingSlip`
  component and its print CSS are gone.
- **GST invoice**: when the GST invoices app is installed, the Invoice template is not printed
  and the pages link to the app's settings (its existing editor allows branding and fields
  only), so the tax invoice stays compliant.
- **Not done**: the print view does not pass the store time zone or currency yet (dates use the
  browser's zone, amounts the default currency); no rich-text editor (HTML textarea).
