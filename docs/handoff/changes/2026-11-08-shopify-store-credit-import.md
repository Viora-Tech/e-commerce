# Shopify import brings customer store credit (store credit step 4, #1227)

- New import resource `store_credit` (packages/plugin-shopify-import): `api-store-credit.ts`
  reads customers with `storeCreditAccounts { id balance }` (API 2026-10; bulk, else paged at
  50 customers × 5 accounts), `write-store-credit.ts` writes it. Runs last, after customers.
- Each INR balance becomes ledger lines on the customer's store credit (`changeStoreCredit`,
  kind `adjustment`, reason `Imported from Shopify (store credit) · Shopify account <n>`).
  Never a gift card. No migration: those ledger lines are the record of what was imported, and
  a re-run adds only the difference to Shopify's balance (nothing when unchanged; a decrease is
  taken back unless the credit was spent here, `store_credit_used_here`). Mapping
  `store_credit: account gid → customer id` feeds the status page.
- Skipped with a report note: other currencies (`store_credit_currency`), customers not here
  (`store_credit_no_customer`), and the whole step without `read_store_credit_accounts`
  (`store_credit_scope`; the run catches the scope error and imports everything else).
  `OPTIONAL_RESOURCES` makes the missing scope a preflight `optional_scope` warning, not a block.
- `ResourceProgress.credit = { customers, amountPaise }`; the run page's Store credit card shows
  "Store credit: N customers, ₹X total imported" ("to import" on a preview). Copy in
  `data/shopify-import*.ts` with Hindi overlays.
- Tests: `test/store-credit-import.test.ts` (import, re-import, changed balance up and down,
  spent here, missing scope, non-INR, preflight warning).
- Docs: merchant guide "Move from Shopify" (new Store credit section), Apps page scopes,
  developer docs Shopify import.
