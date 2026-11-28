# Delhivery: refused bookings, embargoed PINs, label errors, batched tracking (28 Nov 2026)

Branch `fix/delhivery-fail-embargo`, from `origin/dev`. Owner said yes in chat on 28 Nov.

## Why

Order #2503 ships to PIN 682301. Delhivery has that PIN under "Embargo": the pin-codes API says
`remarks: "Embargo"`, its centre is `cn: "NSZ"` with no centre code, and cod/pre_paid still say
"Y". We offered Delhivery there, Delhivery refused the booking twice (package `status: "Fail"`,
blank waybill), and we saved a "Label created" shipment each time on the waybill we had reserved
before the call. "Print label" then answered 502, which Cloudflare replaced with "Bad gateway",
and the hourly tracker asked Delhivery one waybill per call (207 calls refused with 429 in 15 h).

## What changed

1. **Booking refusals** (`packages/shipping-delhivery/src/delhivery.ts`). `delhiveryBookedWaybill`:
   a package counts only with `status` "Success" (any case) and its own waybill; `success: false`,
   no packages, a blank waybill, "Fail" or any other status is a refusal. The reserved waybill is
   never used in its place. `createShipment` and `createReturnPickup` throw a `CourierError`
   (`rejected`) with Delhivery's remarks, errors and `rmk`, so the single and bulk booking show
   why. `createShipmentForOrder` (core) throws before any shipment row, fulfilment or pickup is
   written; a test in `one-booking.test.ts` proves no shipment, nothing packed, order unfulfilled.
   Bulk booking already turns a thrown error into that order's failed row.
2. **Embargoed PINs** (`checkServiceability`). `delhiveryEmbargoed`: remarks containing "embargo",
   or a current centre (no end date `e`) that is "NSZ" or has no code, means not serviceable, with
   `notServed: 'embargo'` (new optional field on `Serviceability`). Every route decision goes
   through `checkServiceability` (checkout Delivery options, admin booking drawer rates, Try a PIN,
   rate compare), so Delhivery drops out for 682301. Cache keys bumped so old "serviceable" answers
   are not read: `{shipping}:delivery-quote:v4` and `{shipping}:serviceability:v2`. Try a PIN's
   trace says "Delhivery: PIN under embargo" (`tryPin.notServed.embargo`, Hindi too).
3. **Label errors** (`packages/core/src/shipping/label-collect.ts`). A skip keeps the courier's
   words as `detail` and its name as `courier`. "No label yet" (Delhivery's `label_not_ready`
   detail code, or the words) is `no_label`. Timeout, unavailable, rate-limited and not-ready are
   asked once more after 1.5 s. `printLabelSheet` logs each skip (courier, shipment id, reason,
   message with links stripped; no customer data). The admin toast reads
   "#2503 Delhivery: no label yet" (`skipLine` in `apps/admin/src/data/label-sheet.ts`).
4. **Label route** (`apps/admin/src/app/api/shipments/[id]/label/route.ts`). The link opens in a
   new tab, so it now answers a small readable HTML page instead of a 502: 409 when the courier has
   not made the label yet ("Delhivery has no label for #2503 yet. Try again in a minute, or print
   it from Delhivery One."; the waybill is swapped for the order number in
   `shipmentLabelFile`), 424 for any other courier failure. Page: `apps/admin/src/lib/label-problem-page.ts`.
5. **Tracker** (`apps/worker/src/shipping.ts`, Delhivery `trackMany`). New optional
   `ShippingProvider.trackMany` / `trackBatchSize`; Delhivery asks up to 50 waybills per call
   (`?waybill=a,b,c`), and `track()` goes through it. Scan times are read as IST (`courierTimeToIso`).
   A shipment Delhivery has no record of that is still `created` 30 minutes after booking gets one
   note on its order (`flagUntrackedShipment`, `packages/core/src/shipping/untracked-flag.ts`,
   written once per waybill). No customer message.

## Checks run

- Typecheck: shipping, shipping-delhivery, queue, core, api, worker, admin: clean.
- Vitest: shipping-delhivery (all), shipping (all), queue `cache.test.ts`; core
  `shipping/delivery-options`, `label-collect`, `untracked-flag`, `one-booking`, `ndr`,
  `courier-rates`; api `label-sheet`, `shipment-details`, `shipping-connection`; worker
  `shipping.test.ts`; admin `components/apps/delivery-options`, `components/shipments`,
  `app/api/shipments`, `lib`. All pass (admin `settings-redirects.test.ts` timed out once under
  load and passed alone).
- Biome on changed files; `lint:components` 223 errors (the baseline, none in these files).

## How to check on localhost

1. Restart admin and storefront so they load the new code (the cache keys changed, so nothing old
   is served).
2. **Try a PIN**: Apps → Delivery options → Try a PIN, enter 682301. Delhivery should not be
   offered, and the trace lists "Delhivery: PIN under embargo". Try 110001: Delhivery is offered as
   before.
3. **Booking drawer**: on a test order to 682301, open Create shipment. Delhivery should show as not
   delivering there. (Do not book a live Delhivery parcel just to see the refusal; the refusal path
   is covered by tests with Delhivery's real "Fail" answer.)
4. **Label page**: on a Delhivery shipment whose label Delhivery has not made, click Print label.
   The new tab shows "Label not ready" and the sentence with the order number, not "Bad gateway".
5. **Print labels** (Shipments → Booked, select a few including one with no label): the toast names
   each left-out label as "#order Courier: reason".
6. **Tracker**: in the worker log, one "shipment tracking failed" per batch at most, never one per
   parcel; a phantom "Label created" Delhivery shipment older than 30 minutes gets one order note
   ("Delhivery has no record of waybill ...").

The two phantom #2503 shipments on live are not touched by this change. After release the tracker
will put the "no record" note on #2503; clearing the rows themselves is a separate step (our Cancel
calls Delhivery's cancel, which may refuse a waybill Delhivery never booked).
