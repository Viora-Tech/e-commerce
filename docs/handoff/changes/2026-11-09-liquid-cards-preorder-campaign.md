# Theme cards honour pre-order campaigns

- **What:** the Liquid product loader (`packages/core/src/theme-import/product-data.ts`) now reads each product's pre-order campaign (active, online store) and decides pre-order with `resolvePreorderSettings`, the product page's rule. A sold-out product in a campaign is `available` with `inventory_policy: continue`, so collection cards show it for pre-order instead of Sold out.
- **Why:** Waimers' "Pulsar Pre-Orders (November)" products said Sold out on collection pages but Pre-order on the product page (#1417).
- **Test:** `packages/core/src/theme-import/preorder-campaign-cards.test.ts`.
- **Cost:** one extra small query per product batch, only when a product is in a campaign.
