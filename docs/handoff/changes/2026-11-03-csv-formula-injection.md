# CSV exports: formula-injection guard everywhere

- `core/api-access/service.ts` `apiActivityCsv`: cells starting with `=`, `+`, `-`, `@`, tab or
  CR get an apostrophe (summaries carry caller text). Before, only quoting was done.
- `invoices/gstr1.ts`, `invoices/gstr3b.ts` and `plugin-affiliates/stats.ts` (ledger CSV): the
  guard now also covers tab and CR, and leaves plain numbers alone, so a negative amount such as
  `-12.00` stays a number for the GST offline tool and the merchant's books instead of turning
  into text. GSTR-3B had no guard before.
- `plugin-affiliates/stats.ts`: its cell helper is now `ledgerCsvCell`; as `csvCell` it clashed
  with `payouts.csvCell` in `server.ts`'s `export *` (TS2308).
- Tests: `plugin-affiliates/test/csv-injection.test.ts` fixed (it expected an `=` in values that
  have none, so six cases always failed) and extended; new `invoices/test/csv-injection.test.ts`.
- Audited and already safe: admin `lib/csv.ts` `toCsv` (customers, products, inventory, orders,
  reports), privacy export, affiliate payouts and TDS report, redirects CSV (paths and targets
  always start with `/` or `http`). The #1034 email builder and branded layout escape text,
  validate colours as hex and allow only `http(s)` links.
