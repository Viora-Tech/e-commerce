# Waimers fixes, 10 Nov 2026: apps, markets, pickups, drafts, pre-orders and checkout

One branch (`fix/apps-lost-update`), one PR into `dev`. Each change is its own commit.

## Apps

- **store.apps writers lock the row.** Fourteen services read the whole `store.apps` record,
  changed their part and wrote it all back; two at once lost one change (Delivery options
  vanished from Installed apps after an install). Every writer now reads through
  `lockStoreApps` (`packages/core/src/apps/locked.ts`, `SELECT ... FOR UPDATE`), so the second
  waits and reads the first one's change. `locked.test.ts` races two writers (it fails with the
  lock removed).
- **App listing shows Installed / Open** for an app already on the store, instead of Install.

## Checkout and delivery options

- **Only enabled-market countries.** `zonesForMarkets` (`packages/core/src/shipping/rates.ts`)
  cuts every shipping zone down to the enabled markets' countries for the country picker and
  both rate loaders, so an imported International zone no longer takes an order from a country
  no market sells to.
- **Cheapest option pre-selected.** The default delivery option is the cheapest one; a
  shopper's own pick is kept while it is still offered.
- **Prepaid-only note is a quiet hint** ("Pay online for this option", muted) instead of a red
  error.
- **Faster courier wins at equal shopper price.** Among routes that charge the shopper what the
  cheapest does (after round-up), the earliest arrival is picked; the store may pay a little more.
  `resolve.test.ts` now covers both cases (a strictly cheaper DTDC still wins).
- **Hide a courier's name per courier** (migration 0236). Off, the card reads only the option
  name, a courier choice reads Air or Surface, and the COD note names no courier.
- **Unpaid checkout drafts hold no stock.** `reserveStock` routes (so sold-out goods are still
  refused) and gives the hold straight back for a draft; `convertCheckoutDraft` routes, holds and
  bills GST per parcel when the money arrives, flagging a refund if it sold out meanwhile. Tests
  that check the numbered-order path at checkout (`tax/origin.test.ts` now too) pin
  `unpaidAsDrafts: 'off'`.
- **Checkout drafts on by default** (#1375), see `2026-11-09-checkout-drafts-on.md`.

## Shipments and pickups

- **Cancelling a label unpacks its items** (`unpackFulfillmentOrder`): order and parcel lines go
  back to To ship, units back on hand and committed at the parcel's location.
- **Tabs To ship / Booked / To be picked up.** Create shipment only books a label. On Booked,
  Create pickup asks the courier for a day and time and makes the manifest; labels on a pickup
  move to To be picked up until the courier scans them. `SHIPMENT_TABS` gained `toPickUp`;
  `shipments.list` takes `onPickup`.

## Drafts

- **Deleting a draft no longer 500s.** Its unfinished payment attempts (created, pending, failed,
  cancelled) go with it; a draft with money in refuses with a clear message.
- **Drafts badge drops by one per draft opened** (migration 0237, `draft_seen`).
  `orders.markDraftSeen` records it and ignores an id that is not one of the store's orders (the
  cross-store guardrail caught the foreign key accepting another store's order). `draft_seen` is
  classified admin-only in `STOREFRONT_CACHE_EXEMPT`.

## Products and pre-orders

- **Set MRP** across the selected variants in the variants bulk bar.
- **#1473: pre-order campaigns take only the picked variants**, plus a per-product limit beyond
  stock (blank keeps the campaign's). The overview moved to
  `packages/core/src/preorder/campaigns-overview.ts` (file-size sweep).

## GST

- **GST settings preview logs its render error** to the console as
  `[gst-invoices] preview render failed`.

## Migrations

- `0236_route_setting_show_name.sql`: `delivery_route_setting.show_name boolean`, nullable; null
  keeps the default (shown).
- `0237_draft_seen.sql`: new table `draft_seen (store_id, user_id, order_id, seen_at)`, unique
  per store, member and order, cascades with the order, RLS through `apply_store_rls()`.

Both are additive, so an older build keeps working during a rolling deploy.

## Splits for the file-size sweep

`place-order.ts` → gift card and store credit steps in `place-order-tenders.ts`;
`shipments-workspace.service.ts` → courier helpers in `shipments-provider.service.ts`;
`campaigns-service.ts` → `campaigns-overview.ts` and `campaign-orders.ts`. The Hindi
`data/hi/product-form.ts` (501 lines, one Set MRP line) is on the sweep's copy allowlist.

## Follow-ups

- **Delhivery panel may not show parcels as "To be picked up"**: Delhivery's pickup request API
  carries no waybills, so their panel may not tie the pickup to the parcels. Ask the Delhivery
  account manager how a pickup request links to waybills.
- **GST settings preview failure** only reproduces in the live browser; the next failure's
  console line `[gst-invoices] preview render failed` names the cause.
- **Orders cancelled before this change (#2425, #2424) stay packed**: unpack-on-cancel is not
  applied backwards.
