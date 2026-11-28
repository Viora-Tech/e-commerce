# Release 28 Nov (b): Delhivery fixes, equal email tiles, bulk ship item picker

Branch `release/nov28b` (from `origin/dev` 636ab90c3). No migration. Owner said yes in chat on
28 Nov 2026 to these three branches together.

## What changed

Merged with `--no-ff`, in this order (each branch has its own handoff note of 28 Nov):

1. `fix/delhivery-fail-embargo` (82be3836c): Delhivery 'Fail' bookings are refused (no phantom
   shipments), embargoed / NSZ PINs are not serviceable, label-collect keeps the courier's words
   and asks once more, the label route answers 409/424 HTML instead of 502, tracking is batched
   (50 waybills a call) with IST scan times, and an untracked shipment gets one order note.
   Cache keys bumped (`delivery-quote:v4`, `serviceability:v2`)
   (`2026-11-28-delhivery-fail-embargo.md`).
2. `fix/email-equal-tiles` (76af2a5dc): stats tiles in one email row are the same height
   (`2026-11-28-email-equal-tiles.md`).
3. `feat/bulk-ship-pick-items` (89176f135): bulk ship Edit shipment item picker;
   `shipments.bulkBook` `perOrder.keep` / `splitReason` / `notifyCustomer` / `codAmountPaise`;
   `packages/api/src/services/bulk-book-split.ts` (`2026-11-28-bulk-ship-pick-items.md`).

Merge work: none. The three merged with no conflicts; the Delhivery and bulk-ship branches touch
different files in `packages/api/src/services`. `bun scripts/gen-mcp-action-docs.ts`: no change.
No file under `packages/db/drizzle` changed and no lockfile or package.json changed.

## Tests

- Typecheck clean: shipping, shipping-delhivery, queue, core, api, invoices, notifications,
  admin, worker, storefront.
- Vitest (2 workers, one package at a time): shipping-delhivery 2 files / 66 tests, shipping
  8/75, queue 4/18, notifications 8/128, core 481/4442, api 131/698 (includes
  `bulk-book-partial.test.ts` and `bulk-ship-per-order.test.ts` on the local DB, 7 tests pass),
  admin 247/1347, worker 16/101, storefront 124/957 (1 skipped). All pass.
- `bun run lint:components`: 223 errors (baseline).
- `bun run test:sweeps`: 17 files / 27 tests fail, the same set as `origin/dev`. Inside those
  already-failing sweeps the Delhivery branch adds offenders: file-size
  (`shipping-delhivery/src/delhivery.ts` 846 → 939 lines), no-orphans (`LABEL_RETRY_DELAY_MS`,
  `UNTRACKED_GRACE_MS`, `untrackedNoteBody`, `delhiveryEmbargoed`, `delhiveryBookedWaybill`,
  `DELHIVERY_TRACK_BATCH`, exported for tests) and source-of-truth-header
  (`core/src/shipping/untracked-flag.ts`). Left for the next sweep cleanup.

## Left to do / for the owner to check

- See each branch's note for the localhost checks; on live: PIN 682301 no longer offers
  Delhivery, Print label on a Delhivery shipment without a label shows "Label not ready",
  bulk ship Edit shipment lets you untick items.
- The two phantom #2503 Delhivery shipments are not touched; the tracker will add a
  "no record" order note.
