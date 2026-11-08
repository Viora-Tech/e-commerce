# Orders page: tab badges in one query (8 Nov 2026)

The Orders page used to call `orders.list` five times on every load: once for the page and four
more times (`perPage: 1`) only to read the totals for the All, Unpaid, Unfulfilled and Pending UPI
tab badges. Each of those ran a full count, a one-row page with about twelve sub-selects, and a
store-wide test-order count, in its own transaction.

- New `orders.tabCounts` (`packages/api/src/services/order.service.ts` `orderTabCounts`): one
  `count(*) filter (where …)` per tab, each built from the same `orderListWhere` the list uses, so
  a badge always equals what its tab lists. Registered as a read in the MCP catalogue.
- `apps/admin/src/app/(admin)/orders/page.tsx` uses it: 2 store transactions instead of 5 for the
  list part, about 13 fewer SQL statements per load.
- `listOrders` now sends its count with the page query and test count together instead of first.
- Test: `packages/api/test/orders-status-split.test.ts` checks every badge equals its tab's list
  total (including an archived order and an unpaid gateway checkout). Not run locally: no
  Postgres on the machine that wrote it (Docker reserved for other work).
