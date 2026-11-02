# Store activity log (Settings → Activity log)

The owner asked "who created the shipping zone 'Kinja' for Bihar?" and nothing could answer it:
the zone had only a timestamp, and evlog request logs reach container stdout only (no drain, 20%
of successful events sampled in production). Every successful staff change is now recorded.

- **Table** `store_activity` (migration `0219_store_activity`, snapshot chained from 0191): actor
  id, name and email, `source` (admin, assistant, mcp, api; worker and storefront reserved),
  `action` (the procedure path), `area`, `resource_type` / `resource_id`, `summary`, `changes`
  (jsonb), `ip`, `user_agent`. RLS through `apply_store_rls()`; classified ADMIN in
  `storefront-cache.ts`.
- **Capture** (`packages/api/src/procedures/activity.ts`, called from `procedures/store.ts`): after
  a store handler succeeds, one insert in a savepoint of the same transaction, so a failed insert
  never fails the change (it is reported instead). Detached procedures insert in their own short
  transaction. Reads (the MCP catalogue's classification), a `NOT_A_CHANGE` list (previews, AI
  drafts, test connections, read receipts) and `test*` procedures write nothing; neither does a
  failed handler or a call queued for approval. A server-side `call()` without a path is resolved
  through the router.
- **Before/after**: handlers may call `context.activity.note({ before, after })`; only the fields
  that differ are kept. Shipping zones update and delete do. Everything else keeps the input.
- **Scrubbing**: `scrubAudit` (`@commerce/observability`) uses `scrubPii`'s key rule (emails,
  phones, addresses, OTPs, any secret/token/password/API key) plus payment details (`keyId`, UPI,
  PAN, bank account, IFSC), and redacts emails, JWTs, gateway keys and long opaque strings inside
  text. Handles, dates and ids stay readable.
- **Permission** `activity.read` ("Activity log" in the role editor). Owners hold it; the
  Administrator role gets it (seeded for new stores; the migration adds it to existing ones). The
  MCP/API **Settings** read area includes it; `activityLog.list` and `activityLog.listPeople` are
  catalogued reads (`activityLog` → settings).
- **Admin**: Settings → Activity log (`/settings/activity`, Team & advanced group, new `History`
  icon in `@commerce/ui/icons`). ResourceTable with the shared filter panel (person, area, source,
  date) and server-side search over action and summary, paginated. A row opens a centred dialog
  with the details and the before/after table. Copy in `data/activity-log.ts` with a Hindi overlay.
- **Retention**: one year. `stores_with_old_store_activity()` (SECURITY DEFINER) and the worker's
  daily `{store}-activity-prune` (`apps/worker/src/store-activity.ts`).
- **Docs**: merchant guide Settings → Activity log; developer docs "Store activity log".
- **Leak test**: `store_activity` is exempt from "A holds B's ids" and `activityLog.list` is
  skipped: the log records the ids a probe typed, by design. Isolation is tested in
  `store-activity.test.ts`.

Not done: rows written by the worker or the storefront (the enum allows them), and before/after
for procedures other than shipping zones. Add `context.activity.note` to a router to get it.
