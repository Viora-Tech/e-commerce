# Admin filters F5: the remaining lists

The last phase of the admin filters plan (F1 shared panel #891, F2 products #910, F3 orders family,
F4 customers/discounts #922). Every list below now has the shared filter panel, with its state in
the URL, filtering on the server, and combining with the tab, search and paging.

| List | Filters | API input |
| --- | --- | --- |
| Purchase orders | status (multi), supplier, destination, expected (custom range), created | `purchaseOrders.list`: `statuses`, `supplierIds`, `locationIds`, `expectedFrom/To`, `createdFrom/To` |
| Transfers | status (multi), origin, destination, created, received | `transfers.list`: `statuses`, `fromLocationIds`, `toLocationIds`, `createdFrom/To`, `receivedFrom/To` |
| Inbound shipments | status (multi), expected (custom range, India day), arrived, has Bill of Entry | `inboundShipments.list`: `statuses`, `expectedFrom/To`, `arrivedFrom/To`, `hasBillOfEntry` |
| Suppliers | country, bills in (currency), has GSTIN, has purchase orders | `suppliers.list`: `countries`, `currencies`, `hasGstin`, `hasOrders`; new `suppliers.facets` |
| Reviews | rating and product now multi, source, has photos, verified buyer, featured, replied, written | `reviews.list`: `ratings`, `productIds`, `sources`, `verifiedBuyer`, `featured`, `replied`, `createdFrom/To` (old `rating`/`productId` still accepted) |
| Blog posts | blog and tag now multi, author, published, has featured image | `blog.list`: `blogIds`, `tags`, `authors`, `publishedFrom/To`, `hasImage` (old `blogId`/`tag` kept); new `blog.authors` |
| Affiliates | status, program, joined, earned | `affiliates.list` takes optional `search`, `statuses`, `programIds`, `joinedFrom/To`, `min/maxEarnedPaise` |
| Commissions | status, from (source), affiliate, order placed, commission amount, held by fraud check | `affiliates.commissions.list` takes optional `search`, `statuses`, `sources`, `affiliateIds`, `placedFrom/To`, `min/maxCommissionPaise`, `flagged` |

Notes:

- Shared pieces for these lists: `apps/admin/src/lib/list-filter-parts.ts` (look-back presets,
  yes/no in the URL, typed bounds, date and yes/no group builders). The "Last 7/30/90 days" and
  "Any date" labels moved into `filterPanelContent` (`lastDays`, `anyDate`).
- Older links keep working: `?rating=5`, `?product=<id>`, `?blog=<id>` and `?tag=x` read as one pick.
- Affiliates and Commissions moved from component state to the URL. They still page in the
  browser (lists cap at 1000 rows), but search and filters now run on the server.
- Transfers copy got its Hindi overlay (`data/hi/inventory.ts`); the page reads it with `useCopy`.
- Affiliates/Commissions filter copy is its own file (`data/affiliate-filters.ts`, Hindi in
  `data/hi/affiliate-filters.ts`) so `data/affiliates.ts` stays under the 500-line cap. The
  Reviews list's WHERE moved to `packages/plugin-reviews/src/review-list-where.ts` for the same reason.
- `action-docs.generated.ts` was regenerated; it also picks up `billing.usageBillCsv`, which was
  already missing on `dev`.
- A filtered list with no rows shows "No X match these filters" instead of the first-run empty state.
- The PO total and inbound charge amounts are worked out per currency in code, not in SQL, so
  those lists have no amount filter.

Tests: `apps/admin/src/lib/stock-content-app-list-filters.test.ts` (parsing),
`packages/api/test/stock-content-app-list-filters.test.ts` (each server filter).
