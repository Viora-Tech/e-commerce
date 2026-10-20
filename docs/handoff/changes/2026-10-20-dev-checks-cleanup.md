# Dev checks back to green after #623, #629 and #625

Branch `chore/dev-checks-cleanup`. No behaviour change, no migration.

- `delete-test-orders-dialog.tsx`: copy read by destructuring, so the component checker sees hooks before handlers.
- Dropped `export` from file-local helpers: `shopPolicies` (theme-import page-context), `ONLINE_STORE_QUERY` and `sellsOnOnlineStore` (Shopify import).
- no-orphans: `productStatus` allow-listed (exported for its unit test); the stale `localHandle` row removed (it has an importer now).
- file-size: `plugin-shopify-import/src/write-content.ts` (505 lines) listed, to split per resource.
