# Pre-order campaigns, overview, rules, content and design (#141 to #144)

Benchmark: Essential Pre-Order (Shopify). Pushed straight to `dev`. Migration
**0208_preorder_campaigns** (table `preorder_campaign`; `product.preorder_campaign_id`,
`product.preorder_own`; `cart_line.preorder_campaign_id`; `order_line.preorder_campaign_id`;
`apply_store_rls()` at the end).

## Where things live

- **Rules, pure and client-safe:** `packages/core/src/preorder/campaigns.ts` (also exported from
  `@commerce/core/preorder`): `campaignApplies` (status, channel, market; a cart without a market
  is in the primary one), `preorderUnitPrice` (percent capped at 90, fixed never below 0),
  `campaignLineIsPreorder`, `soldOutInCartOutcome`, `mixedCartVerdict` (strictest rule among the
  pre-order lines: block > together > split), `campaignNoteSource`, `campaignColours` (hex only,
  so it is safe in a style), the create/update schemas. Tests: `campaigns.test.ts`.
- **Settings merge:** `resolvePreorderSettings(product, variantOverride, campaign?)`. A campaign
  that applies turns pre-order on and supplies ship date, limit, button text, payment; the product
  keeps a setting when `preorder_own` names it (`shipping`, `limit`, `button`, `payment`, `note`).
  A variant's "Allow pre-order: off" still wins.
- **Rows:** `packages/core/src/preorder/campaigns-service.ts` (CRUD, membership, the overview,
  `campaignsByIds`, `availableAtLocations`, `cartPrimaryMarketId`). API: `preorders.*`
  (`packages/api/src/routers/preorders.ts`, products read/write permissions).
- **Admin:** Products › Pre-orders `/products/preorders` (overview: 30-day stats, campaigns with
  orders and revenue, products with the "N of M left" bar), campaign page
  `/products/preorders/campaigns/[id]` (`components/preorders/*`), and the product page's
  "Pre-order & launch" card now has a campaign picker plus "Keep this product's own" ticks.
  Copy `data/preorders.ts` + `data/hi/preorders.ts`.

## Behaviour (server-enforced)

- **Products outside campaigns behave exactly as before** (pre-order on = every line is a
  pre-order, deposit and all).
- **Under a campaign** a line is a pre-order only when the stock that counts (the campaign's
  locations, else every online-selling location) cannot cover it; in stock it sells normally.
- `addToCart`: the campaign must apply (active, `online_store` channel, the cart's market); the
  line keeps `preorder_campaign_id`, its price takes the pre-order discount while it is a
  pre-order, and a `block` mixed-cart rule throws `PreorderMixedCart` (the storefront's
  `addLineAction` returns `{ error }` and the buy button shows it).
- `placeOrder` (`loadCart`): re-resolves the campaign; a line that went in from stock and sold out
  since becomes a pre-order (`sold_out_in_cart: preorder`) or is left as a stock line so routing
  refuses it as out of stock (`block`); prices are re-derived (discount only on pre-order lines,
  back to list price if the campaign no longer applies); mixed `block` refuses the order;
  `together` marks every parcel `on_hold` (waiting with the pre-order; it does not use the
  fulfilment hold, which has no admin release button). Order lines record the campaign id.
- Feeds: `buildChannelCatalog` marks sold-out campaign items `preorder` (Google `PREORDER`, Meta
  `preorder`, OpenAI `preorder`) when the campaign's channels include `social` / `ai_agents`.
- Storefront product page, cards and collection cards read the campaign (button label, note,
  badge, colours, pre-order price, deposit on the discounted price). Pages are cached per store,
  so the storefront leaves the **market** out when showing; the cart and checkout check it.
- Shopify import: each pre-order selling plan group becomes a campaign (`source_id =
  shopify:<gid>`), its products join it unless already in one; re-imports keep the merchant's
  edits to the campaign.

- Every add-to-cart caller honours the `{ error }` refusal: the product page buttons show it,
  the sticky bar and card Quick add do not claim "Added", the Inbox chat card stays idle, and the
  theme `cart-add` route answers 422.

## Left out / follow-ups

- Draft orders ignore campaigns (they ignore pre-order entirely today).
- No admin "release hold" is needed (together uses `on_hold` parcels), but the order page does not
  name the campaign yet.
- Essential Pre-Order's own campaigns (read off the storefront HTML) still only set each
  product's note and per-variant pre-order, as before; they are not turned into campaigns.
- Not run (owner rule): tsc, vitest, lint, builds. Run `bun run test` for
  `packages/core/src/preorder/campaigns.test.ts` and the existing `order/preorder.test.ts` on dev.
