# Where a sale came from, on drafts and abandoned checkouts

November plan item: show "where a sale came from" on drafts and abandoned checkouts, as on the
order page. Branch `feat/sale-source-drafts`. **No migration**: everything needed was already stored.

- **What was already stored**: the storefront stamps the shopper's touch (`wc_attr` cookie plus
  the affiliate `wc_ref`, `readAttribution()`) on `cart.attribution` when the cart is made and
  again when checkout captures the contact (`setCartAttribution`). Placing an order copies it to
  `order.attribution` (`place-order-create.ts`). A checkout draft *is* that order row
  (`status = 'draft'`, `draft_source = 'checkout'`), so it already had the attribution, and
  converting or paying it flips the same row, so the order keeps it. A recovered abandoned
  checkout places its order from the same cart, so the order copies the cart's touch: the newer
  one if the shopper's return visit recorded one (checkout's `setCartAttribution`, last non-direct
  click as before), else the one the abandoned checkout page showed. Nothing is copied twice.
- **One card for all three pages**: `components/orders/sale-source-card.tsx` ("Where it came
  from"). An agent or social channel still draws the existing `SalesChannelCard`; any other
  recorded touch lists channel, referring site, UTM source / medium, campaign, first page,
  affiliate code and visit time (rows from `lib/sale-source.ts`); a staff draft says "Created in
  the admin" with who, through what (assistant, MCP, token) and when. Nothing recorded draws
  nothing. Used on the order side column (so orders from search, email, referral and so on now
  show the card too, not only agent/social ones), the checkout draft view, the staff draft
  editor (saved drafts only) and the abandoned checkout page (it replaces the customer card's
  old "Came from" row).
- **Who made a staff draft**: no new column; `orders.getDraft` adds `createdBy` from Settings →
  Activity log (`services/draft-creator.service.ts`): the first `orders.saveDraft` row for the
  draft whose input had no id, or its `orders.duplicateOrder` row. `duplicateOrder` now notes
  the new draft's id on its log row (it used to name the source order). Drafts older than the
  log, seeded ones, or duplicated before this change show "A staff member" with no date.
- **Abandoned list**: a Source column and a Source filter (same channels and names as Orders →
  Channel, `untracked` = none recorded). `listAbandoned` takes `channels` and returns `channel`;
  `getAbandoned` returns `attribution` instead of the old `source` string.
- Copy: `data/sale-source.ts` (+ `data/hi/sale-source.ts`), filter words in
  `data/order-list-filters.ts`. Tests: `packages/api/test/sale-source.test.ts`,
  `apps/admin/src/lib/sale-source.test.ts`, `order-filters-f3.test.ts`.
- Not done: an order converted from a staff draft has no attribution, so its order page shows no
  card (it could say "Created in the admin" the same way; owner to decide).
