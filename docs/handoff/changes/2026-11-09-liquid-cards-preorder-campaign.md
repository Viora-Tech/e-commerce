# Theme cards honour pre-order campaigns

- **What:** the Liquid product loader (`packages/core/src/theme-import/product-data.ts`) now reads each product's pre-order campaign (active, online store) and decides pre-order with `resolvePreorderSettings`, the product page's rule. A sold-out product in a campaign is `available` with `inventory_policy: continue`, so collection cards show it for pre-order instead of Sold out.
- **Why:** Waimers' "Pulsar Pre-Orders (November)" products said Sold out on collection pages but Pre-order on the product page (#1417).
- **Test:** `packages/core/src/theme-import/preorder-campaign-cards.test.ts`.
- **Cost:** one extra small query per product batch, only when a product is in a campaign.
- **Also:** chat widget product cards (`productCards` in `packages/core/src/inbox/panel.ts`) said Sold out for every pre-order product (own switch or campaign); they now offer the first variant that sells on pre-order, under its limit. Test in `panel.test.ts`.
- **Swept, already right:** React cards (`catalog.ts`, `collections.ts`), product page, search suggestions, structured data (`seo.ts`), cart and checkout. Theme home carousels, related products and recommendations all go through the Liquid loader fixed above.
