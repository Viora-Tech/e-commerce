# Shipping review fixes: RapidShyp COD amount, box sizes, pickups after a refusal, GST void

Six fixes from the 23 Nov shipping review. No migration.

## RapidShyp collects the right COD amount

`packages/shipping-rapidshyp/src/amounts.ts` (`orderAmounts`), used by `buildOrderPayload` in
`booking.ts` for both booking and order push. Before, RapidShyp only got the items at their prices
before any coupon, so a COD order with a coupon or a shipping fee could be collected at the wrong
amount. Now the order also carries `shippingCharges`, `totalDiscount`, `codCharges` and
`prepaidAmount`. These field names come from RapidShyp's docs (Forward B2C > Create Order, and the
B2C Wrapper API). The booking only knows the parcel's value and the amount to collect, not the
order's breakdown. So the gap between the items and the value goes in as shipping (when the value
is higher) or discount (when it is lower). On COD, a collect amount below the value goes in as
`prepaidAmount`, and one above it as `codCharges`. What RapidShyp then collects equals
`codAmountPaise`, the amount the admin shows. `core/shipping/order-push.ts` needed no change: it
sends the order total as both value and COD amount, and the same payload builder now adds the
amounts.

## Shiprocket sends the real box size

`boxCm` in `shiprocket.ts` sends `input.dimensionsCm` as length, breadth and height (forward
orders and returns), and falls back to a 10 cm cube when there is none, the same way RapidShyp's
`packageDetails` does. Returns now pass the store's main box (`core/returns/service.ts`, the new
optional `ReturnPickupInput.dimensionsCm`).

## RapidShyp: Create pickup works when the pickup failed at booking

When RapidShyp refused the pickup at booking, the parcel stayed in Booked, and Create pickup was
hidden for every RapidShyp parcel. Now `pickupHeldByCourier` (`api/services/courier-pickup.ts`)
blocks Create pickup only when the parcel is already on a pickup. The rule is applied in the
details view (`canRequestPickup`), the list rows, the Pickups picker, the Create pickup drawer and
`schedulePickupForStore`. "Move back to Booked" is still refused for these couriers. RapidShyp
now has a `schedulePickup` (`src/pickup.ts`): it reads each parcel's shipment id from Track Order
by its AWB, then calls `schedule_pickup`. Its capabilities now include `pickup`.

New shared pieces: `ShippingProvider.pickupPerParcel` and `SchedulePickupInput.parcels` (each
parcel's AWB and `providerRef`). For a courier with `pickupPerParcel`, core's `schedulePickup`
always asks the courier and never joins a pickup that is already booked. The drawer also shows no
existing pickups to join for that courier.

## Shiprocket asks for the pickup at booking (owner approved)

`shipping-shiprocket/src/pickup.ts`. After the AWB, `createShipment` calls
`POST /courier/generate/pickup` with `{ shipment_id: [id] }`. Success is read as
`pickup_status: 1`, the shape published SDKs use (ShipKore libshipkore, mritunjay10/shiprocket-api).
When Shiprocket takes it, the booking returns `pickupScheduled` and the parcel moves to To be picked
up. When it refuses or the call fails, the parcel stays in Booked, and Create pickup asks again by
the saved shipment ids (`providerRef`). Capabilities gained `pickup_at_booking` and `pickup`. The
old developer error in `schedulePickup` ("not wired here") is gone. A refusal now reads, for
example, "Shiprocket did not take the pickup: <its words>". The Pickups list adds a line under a
failed pickup ("The parcels stay in Booked…", `pickupStaysBooked` in `data/shipments.ts` + Hindi).
The courier app overview pages got labels for `pickup` and `pickup_at_booking`, and new Hindi
overlays `data/hi/rapidshyp.ts` and `data/hi/shiprocket.ts` (capabilities only, the rest marked
`untranslated`).

Not live-tested: no real Shiprocket or RapidShyp calls were made. Tests use a mocked fetch.

## GST: a cancel + full refund leaves outside invoices alone

`plugin-gst-invoices/src/void-unshipped.ts`. Invoices recorded outside Koomerce
(`source: 'external'`, "Already invoiced") are no longer cancelled. The activity line names a
document by its number, never by its raw id ("an invoice recorded outside" or "an unnumbered
invoice" when it has none).

## Tests

- `shipping-rapidshyp/test/amounts-pickup.test.ts`
- `shipping-shiprocket/test/pickup-box.test.ts`
- `plugin-gst-invoices/test/void-unshipped.test.ts` (pure, needs no database)
- `api/test/courier-pickup.test.ts` was updated. It needs Postgres and was not run here.
