# The admin shell reads in one call

Every signed-in admin page's layout made seven store calls for the sidebar and banners:
`apps.list`, `themes.logo`, `orders.toShipCount`, `billing.usage`, `payments.testMode`,
`approvals.counts` and (with Inbox installed) `inbox.counts`. Each opened its own transaction
(begin, set_config, the query, commit) and took a pool connection at the same moment as the
page's own calls (the pool is 10 per process).

- New `store.shell` (`packages/api/src/routers/shell.ts`): the same reads in one call, one
  transaction. Each part is `null` when the member's role cannot read it (what the separate call
  refused), `testMode` is `false` then; `inbox` is `null` until Inbox is installed.
- `apps/admin/src/lib/shell-data.ts`: `listApps`, `liveLogoUrl`, `ordersToShipCount`,
  `planUsageSummary`, `paymentsTestMode`, `approvalsBadgeCount` and `inboxUnreadCount` keep their
  names and answers but read their part of one React-`cache`d `store.shell`. Pages that use them
  (Home, the order page) still share the layout's read.
- `apps.list` and `billing.usage` now call `listStoreApps` / `planUsageCard`, which the shell
  shares. The separate procedures stay for the pages and clients that call them.
- Test: `packages/api/test/store-shell.test.ts` (same answers as the separate calls for the
  owner; parts left out for a role with only `orders.read`).
- No migration, no new env keys.
