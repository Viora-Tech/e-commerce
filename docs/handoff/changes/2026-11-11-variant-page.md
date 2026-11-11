# Variant page (#1543)

Branch `feat/variant-page`, built on `feat/preorder-variant-limit` (#1537) and
`fix/variant-box-approval-notice` (#1540). Merge those first, then rebase this onto `dev`.
No migration, no API change.

- Owner's decision: one variant gets a full Shopify-style page, replacing the centred Edit dialog
  with Previous/Next (#914) and the variant metafields grid on the product page (#894).
- Route `/products/[id]/variants/[variantId]` (`routes.products.variant`), page in
  `app/(admin)/products/[id]/variants/[variantId]/`, client code in
  `components/products/variant-page/`. Copy: `data/variant-page.ts` + `data/hi/variant-page.ts`
  (the old `variants.dialog` copy moved there as `fields`).
- Layout: header ("‹ <product>" back link, variant image and title, product status chip, More
  actions → Delete variant, Save); left column lists every variant (thumbnail, title, price,
  stock, current highlighted, links go through the save bar's `LeaveGuard`); below `lg` the list
  is a select above the cards (asks "Leave without saving?" with the same copy). Right column
  cards: Options (pick each option's value from the product's values, a clash with another
  variant blocks Save; Hide on store), Image (`VariantImagePicker`), Pricing, Inventory (SKU,
  barcode, track, stock, pre-order allowed + limit, "Stock at each location" → bulk editor),
  Shipping (physical, weight, own Box, country, per-variant HSN/GST), Metafields.
- The old `variant-edit-fields.tsx` is split into `variant-pricing-fields`,
  `variant-inventory-fields`, `variant-shipping-fields`, `variant-options-fields` (+ `switch-row`).
  Pre-order limit helpers moved from `form-state.ts` to `variant-preorder-limit.ts` (the merge of
  #1537 and #1540 put `form-state.ts` over the 500-line cap).
- Saving: the page loads the whole product (`products.get` → `fromProduct`), edits only this
  variant, and saves through `products.save` like the product form (`variantPageWrite` in
  `variant-page-state.ts` = `toWrite` with `onHand` sent only for this variant and only when it
  changed, so a sale of another variant since the page loaded is not written back). Server merge
  rules for `preorderOverride` and `box_own` are untouched. Then the variant's metafields go
  through `metaobjects.setMetafields` (`use-variant-metafields.ts`). One save bar for both.
- Delete variant = `products.save` without that variant (what the Variants tab's bulk Delete
  does; the server archives it when orders reference it), then back to the product's Variants tab.
  No "Duplicate variant": variants are option combinations, so there is nothing to duplicate into.
- Variants tab: a row's title and pencil link to the page; inline price/MRP/SKU/stock and bulk
  selection unchanged. Rows added since the last save have no page: the pencil is greyed out
  with "Save the product first…". A product without options gets **Variant details** on its
  Variants card (its one variant's page: barcode, weight, metafields).
- Removed: `variant-edit-dialog.tsx`, `variant-edit-fields.tsx`, the grid
  `variant-metafields-card.tsx` (a new controlled one lives in `variant-page/`), and the product
  form's variant-metafield save plumbing; unused grid copy in `data/metaobjects.ts`.
- Merchant guide: `products/products-collections.mdx` ("A variant's own page") and
  `products/pre-orders.mdx`.
- Not verified: no browser check yet (no dev server was run). Stock per location is not edited on
  the page itself (the product save writes the default location only); it links to the bulk
  editor instead.
