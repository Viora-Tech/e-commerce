# Customers page stat tiles: one pass over orders (8 Nov 2026)

`customerStats` (`packages/api/src/services/customer.service.ts`) worked out "Returning" and
"Average lifetime spend" by running two sub-queries per customer: an order count and the full
spend formula. For 20k customers that is about 40k sub-queries on every Customers page load.

- **Returning** now groups the store's counted orders by customer once (`having count(*) > 1`).
- **Average lifetime spend** is the store's total spend divided by the customer count. The total
  comes from the new `allCustomersSpentSql()` in `packages/core/src/customers/spent.ts`, which uses
  the same per-order formula as `customerSpentSql`, so there is still one source of truth. A
  customer with no orders still counts as 0, as before.
- Covered by the existing stats assertions in `packages/api/test/customers.test.ts`. Not run
  locally: no Postgres on the machine that wrote it.
