# Order detail and edit pages: half the reads (8 Nov 2026)

- **Payment history no longer reads every webhook.** `eventsForPayments`
  (`packages/api/src/services/order-detail.service.ts`) found an order's gateway events by
  turning every stored `payment_event` payload in the store into text and searching it. It now
  reads only events from a day before the order's first payment on, because a gateway cannot send
  an event for a payment before that payment exists. An index on `payment_event (store_id, received_at)`
  arrives in the indexes PR, so this becomes an index range read.
- **One record read per page.** Order, product, customer, collection and discount detail pages
  loaded their record twice: once in `generateMetadata` for the browser-tab title and again for
  the page. A React `cache` loader per page now shares one read.
- **`orderBalance`** (`order-fulfil.service.ts`) adds up refunds for all of an order's payments
  in one query instead of one query per payment. Its unused `storeId` parameter was dropped.
- Tests: `packages/api/test/order-balance.test.ts` (balance cases updated, new event-window
  case). Not run locally: no Postgres on the machine that wrote it.
