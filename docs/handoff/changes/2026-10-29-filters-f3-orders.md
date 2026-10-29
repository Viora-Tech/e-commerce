# Filters F3: Orders, Drafts, Abandoned checkouts, Returns, Shipments

Third step of the admin filters plan (F1 shared panel, F2 catalogue lists). Every filter lives in
the URL, combines with the tab, search and pagination, and is applied server-side.

- **Orders** (`lib/order-list-filters.ts`): new **Collection** (#886: a line's product is in any
  picked collection, via `collection_product`), **Order value** range, **Channel**
  (`attribution.channel`, plus "Not tracked"), **Tags**, **Discount code** (any case) and
  **Return status** (no return / asked for / on the way / returned / declined, from customer
  `return_request`s; RTO stays the Returned fulfilment). They join the existing Product, Payment,
  Fulfilment, Date (custom range already in F1), Payment method and Courier.
  `orders.list` / `orders.ids` share one input schema and take `collectionIds`, `totalMinPaise`,
  `totalMaxPaise`, `channels`, `tags`, `discountCodes`, `returnStatus`. New `orders.facets`
  returns the store's order tags, discount codes, couriers and collections; the page uses it
  instead of `orders.couriers` (kept). Collection, Tags, Discount code and Courier show only once
  the store has some. The page now reads its URL state as one object (`q`) like Products.
- **Drafts** (`lib/draft-list-filters.ts`): Created (presets or custom) and Total.
  `orders.listDrafts` takes `createdFrom`, `createdTo`, `totalMinPaise`, `totalMaxPaise`
  (`listDrafts` in core). Columns moved to `components/drafts/draft-columns.tsx`.
- **Abandoned checkouts** (`lib/abandoned-list-filters.ts`): Last active (its start replaces the
  30 day window, so older carts can be found), Cart value, Contact left (email / phone / both).
  `orders.listAbandoned` takes `activeFrom`, `activeTo`, `valueMinPaise`, `valueMaxPaise`,
  `contact` (`ABANDONED_CONTACTS`, `listAbandoned` in core).
- **Returns** (`lib/return-list-filters.ts`): Reason, Outcome (resolution) and Asked on.
  `returns.list` takes `reasons`, `resolutions`, `requestedFrom`, `requestedTo`.
- **Shipments** (`lib/shipment-list-filters.ts`): Courier and Delivery problem (NDR) were accepted
  by `shipments.list` but never sent; now wired, plus Booked date and Payment method.
  `ndrStatus` is now a checked enum (`SHIPMENT_NDR_STATUSES`). The panel shows on every tab but
  To book (which lists orders); moving to To book clears it.
- Shared helpers: `lib/list-filter-groups.ts` (day presets, rupee bounds, money range group).
  Copy: `data/order-list-filters.ts` (+ Hindi), new keys in `ordersContent.filters` (+ Hindi).
  Merchant guide pages for all five lists updated.

Tests: `apps/admin/src/lib/order-filters-f3.test.ts`,
`packages/api/test/order-section-filters.test.ts`.

Splits to keep the size sweep green: the Orders list's where clause, filter constants and facets
moved from `order.service.ts` to `services/order-list-where.ts` (re-exported, so imports are
unchanged); `listReturns` / `returnCounts` moved from `returns/service.ts` to `returns/list.ts`
(re-exported from `service.ts`).
