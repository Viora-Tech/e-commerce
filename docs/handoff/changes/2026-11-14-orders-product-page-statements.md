# Orders list and product page: fewer statements, less JS (14 Nov 2026)

Branch `perf/admin-orders-product`. Measured with `packages/api/test/admin-page-statements.test.ts`
(counts every statement the driver sends, `begin`/`set_config`/`commit` included, on a store with
one 20-variant product and 60 orders; `STATEMENTS_DUMP=<dir>` writes them out):

| | Before | After |
| --- | ---: | ---: |
| Orders: server render (layout shell + page) | 57 (31 + 26) | 34 (28 + 6) |
| Orders: browser reads at load | 12 | 12 |
| Product page: server render (shell + page) | 54 (31 + 23) | 45 (28 + 17) |
| Product page: browser reads at load | 48 | 28 |
| Activity log rows per view (every admin page / product page) | 1 / 2 | 0 / 0 |

- **Page views wrote activity log rows.** `store.shell` (every admin page) and `products.sales`
  (product page) were classified as changes, so each view ran a savepoint and an insert into
  `store_activity` and filled Settings → Activity log. Both are now in `READ_PATHS`.
- **`orders.listPage`**: the Orders page's four server calls (`list`, `tabCounts`, `tiles`,
  `apps.orderActions`: four transactions, 26 statements) are one call and one transaction: the
  rows, one aggregate over the store's orders (match count, test orders, tab badges, stat cards)
  and one store row. The browser still pages with `orders.list`. `orders.tiles` is one statement
  (was five, and summed a fortnight of orders in JavaScript).
- **Order actions** (`apps.orderActions`, order page too) read only the store row's app and
  provider columns, not the Installed apps list's history, installers and last activity (5 → 1).
  `getConnectedProviderIds` no longer reads `select *` of the store row (theme, navigation...);
  `storeAppSummaries` reads the row once (was twice).
- **`products.getPage`**: the product page's `get`, `facets` and `ai.status` (three transactions)
  are one, and it carries the store's shipping boxes for a member with `settings.read`, so the
  Shipping tab no longer reads all of `store.getShipping` from the browser. "Add product" calls it
  without an id. `getProduct` sends its seven reads together instead of one after another and no
  longer re-reads each variant's `media_id`; facets read distinct option values.
- **Browser**: product page tabs mount their cards when first opened (stock history, pre-order
  campaigns, Search Console and app sections no longer load for hidden tabs), then stay mounted.
  Dialogs closed at load load their code on first open (`useOpenedOnce`): product duplicate, run
  automation, Write with AI, image alt text / editor / media picker, and the Orders bulk, bulk
  fulfil and delete-test-orders dialogs.
- `createDb(url, { onStatement })` hears every statement (tests count with it). New modules:
  `services/order-list-page.service.ts` (list rows, counts, cards, `orderListPage`; re-exported from
  `order.service.ts`) and `services/product-page.service.ts` (`getProduct`, `productPage`), so
  neither service passes the 500-line sweep. `getConnectedProviderIds` is gone (`storeAppsAndProviders`).
- No new index: the list's filters and sort are covered (`order_store_placed`,
  `order_store_status`, payment/fulfilment status, `order_store_number`), and the product reads use
  `variant_product`, `product_option_product`, `variant_option_value_variant`,
  `product_media_product`, `variant_media_unique`. No migration.

Left alone: the layout's `store.shell` still costs 28 statements on every page (two `store_plan`
upserts, a savepoint per installed app with a `lastUsed` read, a group-by over all media).
