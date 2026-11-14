# Admin layout: 28 → 23 statements per page, no writes

- `ensureStorePlan` (core billing) reads the plan row first and inserts only when it is missing.
  The admin layout (`store.shell`) used to run `insert … on conflict do nothing` twice on every
  page, plus two selects.
- The sidebar usage card (`planUsageCard`) counts this month's orders only (`planOrdersUsed`);
  the full `planUsage` (staff, storage, AI) stays on the Plan page.
- `packages/api/test/admin-page-statements.test.ts` now holds the shell to 23 statements and no
  insert/update/delete.
