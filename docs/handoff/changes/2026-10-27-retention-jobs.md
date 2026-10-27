# Nightly retention prune: old carts, outbox rows and webhook payloads

Schema review 27 Oct (`docs/reviews/2026-10-27-schema-review.md`), P0 item 3 (carts are never
deleted) and P1 item 6 (logs kept forever). Branch `feat/retention-jobs`. No migration of its own:
the store list is `stores_with_retention_due` from migration 0177.

One daily worker job, `{retention}-prune`, at 03:30 India time (BullMQ cron `30 3 * * *`,
`tz: Asia/Kolkata`; the other prunes use `every: 24h`). It visits the stores that
`storesWithRetentionDue(db, now)` lists (`@commerce/db`; SECURITY DEFINER
`stores_with_retention_due`, migration 0177), which uses the same rules:

| Rows | Kept | Then |
|---|---|---|
| `cart` + `cart_line`, open, no email or phone | 30 days since `updated_at` | deleted |
| `cart` + `cart_line`, not converted, with an email or phone (Abandoned checkouts) | 90 days | deleted |
| `cart` + `cart_line`, converted | 30 days | deleted |
| `outbox_event`, dispatched | 30 days after `dispatched_at` | deleted; undispatched never |
| `payment_event`, `shipment_webhook_event`, processed or failed | 180 days after `received_at` | `payload` = `{}`, row kept |

- Code: `packages/core/src/retention/` (`carts.ts` `pruneCartBatch`, `logs.ts`, `job.ts`
  `runRetentionJob`, `RETENTION_QUEUE`, `RETENTION_SCHEDULE`); worker `apps/worker/src/retention.ts`,
  registered in `index.ts` (watched, scheduled, closed on shutdown).
- 500 rows per statement, each batch its own `withStore` transaction, carts locked with
  `FOR UPDATE SKIP LOCKED`; at most 100 batches per store and table per night, so a big backlog
  clears over a few nights. Each part (carts, outbox, payment payloads, courier payloads) has its
  own try/catch: a failure is logged (`area: retention`) and the run goes on.
- Before a cart is deleted, `notification.cart_id` and `marketing_automation_run.cart_id` are set
  to null (the rows stay). `order.cart_id` and `automation_run.cart_id` have no foreign key and
  keep the old id. `retention.test.ts` reads `pg_constraint` and fails when a new foreign key to
  `cart` appears, so whoever adds one handles it in `pruneCartBatch`.
- Docs: developer docs, Data model overview, "Retention" (every prune and its period, for the
  privacy policy).

Known effects and follow-ups:
- A cart with status `abandoned` and no contact matches no rule and stays (no code writes that
  status today).
- The SQL function and `pruneCartBatch` / `logs.ts` must keep the same rules; the tests run the
  job through the function, so a drift shows as a store not visited or visited for nothing.
- The order page's payment history finds `payment_event` rows by the gateway ids inside
  `payload`, so events older than 180 days drop out of it once emptied.
- `orders.abandonedStats` / `listAbandoned` accept up to 90 days (API, MCP). Converted carts go at
  30 days, so "recovered" undercounts in windows over 30 days. The admin and AI tools ask for 30.
- 0177 added `cart_store_status_updated` and `cart_line_cart`, which the cart batches use.
  `marketing_automation_run (cart_id)` still has no index, so each deleted cart costs a scan of
  that table for its foreign-key check; worth adding in the next index migration. `outbox_event`
  has no index for dispatched rows (`(store_id, dispatched_at) where dispatched_at is not null`
  would do) once the table is large.
- An automation's "send this order email once" check looks for an earlier outbox row; after 30
  days it no longer finds one, and the notification table's own once-per-template check stops the
  second send.

Tests: `packages/core/src/retention/retention.test.ts` (database).
