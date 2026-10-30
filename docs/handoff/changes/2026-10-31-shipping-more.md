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
