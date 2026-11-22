# RapidShyp booking truth (order #2082, 22 Nov 2026)

The owner booked a real RapidShyp shipment on order #2082 (one wrist rest). Four things the
shipment said did not match what RapidShyp did. Each is fixed, with tests on fixtures only (no
real RapidShyp call, no live database).

## 1. Courier picked vs courier booked

- We already sent the picked courier: `create_order` with no courier, then `assign_awb` with the
  row's `courier_code` (`packages/shipping-rapidshyp/src/booking.ts`). RapidShyp can still put
  another courier on the shipment. One likely way: `approve_orders` (called when `create_order`
  returns no shipment id) may assign one by the account's courier priority before our
  `assign_awb` call. Nothing in our API calls can stop RapidShyp doing that.
- So we now record what RapidShyp booked. `assign_awb`'s `courier_code` / `courier_name` (or the
  wrapper's `courierCode` / `courierName`) come back as `CreateShipmentResult.bookedService`
  (new optional field in `@commerce/shipping`).
- When the booked service is not the picked one, `bookedCourier`
  (`packages/core/src/shipping/booking-truth.ts`) saves the shipment as "Blue Dart Surface
  (RapidShyp)" with that carrier. The order timeline gets a note. The quote is not saved as the
  charge, because it was for the other courier. The Create shipment done step shows a warning
  (`createShipmentContent.done.swapped`, Hindi too) and shows no charge.

## 2. Weight and box

- RapidShyp was always sent a 10 x 10 x 10 cm box (`packageDetails` was hardcoded). It now gets
  the parcel's `dimensionsCm`, and only falls back to the 10 cm cube when the parcel has no box
  (`packages/shipping-rapidshyp/src/package.ts`). The weight still goes in grams (`packageWeight`,
  grams in RapidShyp's order APIs; only serviceability takes kg).
- The single-order Create shipment page already sent the merchant's weight and box, and core
  already saved them (now covered by `booking-truth.test.ts`). The bulk drawer, though, only sent
  a package for rows edited in its Edit popup. Every other row was booked with the server's own
  sum: the product's own 37 x 14 x 4 cm box instead of the box the couriers were asked about. It
  now always sends the weight and box it quoted (`bulkBookRequest`). I could not confirm from
  code which path #2082 took, or where its stored 1 kg came from: that needs the live row (not
  read here).

## 3. Pickup scheduled at booking

- RapidShyp schedules the pickup during booking: the wrapper sets `pickupScheduled`, and the
  picked-courier and pushed-order paths call `schedule_pickup`. The adapter now reports
  `pickupScheduled: true` when the wrapper says so or `schedule_pickup` answers `SUCCESS`.
- Core (`recordPickupAtBooking`) then puts the shipment on a `scheduled` `shipment_pickup` for
  today at its pickup place: the open one for that courier, place and day, else a new one with
  `time_from = ''` (`COURIER_SLOT`). Because `pickup_id` is set, the shipment lists under
  Shipments › To be picked up, not Booked (tab counts and filters use `pickup_id`). Create pickup
  does not offer it again. The shipment card says "Pickup scheduled for <day>: the courier
  booked it with the shipment and comes in its own time slot" (`pickupAtBooking`, Hindi too).
  The done step skips the pickup request too.

## 4. Courier charge for Profit

- `orders.createShipment` and `shipments.bulkBook` (`perOrder`) take `quotedChargePaise`: the
  picked row's price before insurance (insurance is kept apart in `insurancePaise`). Core saves
  it as `shipment.courierChargePaise` when the courier booked that row. A charge in the courier's
  own answer (`result.chargePaise`) wins. The Profit card's Courier charge input still overrides
  it.

## Checks

Ran: `packages/shipping-rapidshyp` vitest (62 passed), core `booking-truth.test.ts`,
`shipments.test.ts` and `pickup-leave.test.ts`, admin `bulk-ship-state.test.ts` and
`flow-state.test.ts`, and tsc for shipping-rapidshyp, core, api and admin (all clean). Not run:
the full suites (they run on dev). No migration was needed.

## Follow-up after order #2088 (22 Nov 2026, 23:11 IST)

- Charge: we saved ₹141.63 (RapidShyp's `total_freight` quote for 1 kg) but the wallet took
  ₹74.47. RapidShyp's docs list `total_freight` as the only price field, with no breakdown
  (GST, RTO and so on are not stated), and no API that returns a booked shipment's charge
  (`get_orders_info` only has the order's own shipping and COD fields). So a RapidShyp quote is
  no longer saved as the courier charge: the new `ShippingProvider.quoteIsCharge = false`
  stops that in `bookedCourier`. Profit shows its estimate until the merchant types the
  wallet figure. Other couriers keep saving the quote.
- Package: a read-only check of the live database for #2088 found the wrist rest variant at
  500 g with no package size or box. The store's default box is "All Detchable Cable",
  20 x 20 x 5 cm and 10 g, so the page opens at 510 g, 20 x 20 x 5. The saved 1000 g and
  37 x 14 x 4 cm match no product or box. They are what the Create shipment request carried
  (the same values went to RapidShyp and the quote, hence the 1 kg rate). #2082's first booking
  on 21 Nov carried 1000 g and 38 x 13 x 4 cm, which looks like a box measured and typed by
  hand. No code path makes these numbers; ask the owner whether they were typed in the
  Package card before booking.
