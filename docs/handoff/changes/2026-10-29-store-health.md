# Store health: setups that break or hurt checkout, with a fix link each

Branch `feat/store-health-check`. No migration. Background: on 21 Oct Waimers' checkout said
"We do not ship to <PIN>" for every address because the Shopify import left two shipping zones
that listed every state but had no rates. `quoteShipping` now falls through, but the merchant was
never told; this check tells them.

- **Checks (pure):** `packages/core/src/store-health/checks.ts` (`@commerce/core/store-health`),
  tests beside it. Severities: `blocks_checkout`, `should_fix`, `nice_to_have`.
  - Shipping: zone with no rates (should fix), zones covering exactly the same places (should
    fix), states no zone *with a rate* reaches (blocks checkout; skipped with no zones, since
    shipping is then free, and when an everywhere zone has a rate), origin PIN code never saved
    in Settings → Shipping (should fix; the parser's `110001` default does not count), no courier
    besides the demo one (should fix).
  - Products (active, not gift cards / the payment-test product): live variants with no weight or
    0 g, products with a ₹0 variant (should fix), products without an image (nice to have).
  - Payments: nothing on at checkout (blocks), a gateway on test keys (blocks: its payments are
    not real), no live online gateway or every online method off (should fix), a live gateway
    with no `payment_event` ever (should fix once a payment was captured more than 15 minutes
    ago, else nice to have).
  - Store: required policies not published (should fix), sender email pending/failed (should
    fix) or none (nice to have).
- **API:** `store.health` (settings.read), `packages/api/src/services/store-health.service.ts`
  reads the facts. MCP: a read.
- **Admin:** Settings → Store health (`/settings/store-health`, Store group), a Store health card
  on Home under the set-up cards (hidden without settings.read), and "Store health after this
  import" on a finished (non-preview) Shopify import run. Fix links: the zone, Shipping, new zone,
  App Store couriers, Payments, Policies, Notifications, and the Products list filtered.
- **Products list:** new "Missing" filter (`?missing=weight|image`, `products.list` input
  `missing`). ₹0 products link to `?status=active&priceMax=0`.
- Copy: `apps/admin/src/data/store-health.ts`, Hindi in `data/hi/store-health.ts`.
