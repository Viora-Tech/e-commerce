# GST Exports tab, Orders "Ships to" filter, media jobs after commit

- **GST invoices → Exports tab**: export documents only (`invoice.supply_type` not `domestic`:
  EXP invoices, ECN credit notes, export vouchers). `ListFilter.exportsOnly` in
  `packages/plugin-gst-invoices/src/reports.ts`, `exportsOnly` on the shared list `Filter`, so bulk
  download/print/email follow the tab.
- **Orders → filter "Ships to" (India / International)**: `destination` on `orders.list`; an order
  is international when its shipping address country is not `IN`, and one with no shipping
  address counts as India (`destinationWhere` in `order-list-where.ts`). Test in
  `packages/api/test/order-product-filter.test.ts`.
- **Media jobs after commit**: `media.confirm` and `media.replaceFromUrl` queued the processing
  job inside the transaction, so a fast worker could read the row before the change was saved
  (seen on 16 Nov replacing Waimers photos: the first run processed the old photo, the retry the
  new one). Both now queue through `context.afterCommit`.
