# Shiprocket: booked courier, real charge, COD amount (23 Nov 2026)

The two RapidShyp fixes from 22–23 Nov (`ceb3ba149` booking truth, `83efe0723` quote is not the
charge, `e7551a08c` COD amounts) were never made for Shiprocket. Tests use fixtures only (no
real Shiprocket call, no live database).

## 1. Booked courier and charge

- What was wrong: `createShipment` read only `awb_code` from `/courier/assign/awb`. The courier
  Shiprocket really put the AWB with was dropped, so a swap was never noticed. A booking with no
  courier picked (Shiprocket chose its recommended one) saved no courier name. The picked row's
  quote was saved as the courier charge, and Profit used that quote.
- Now `packages/shipping-shiprocket/src/booked.ts` returns the assigned `courier_company_id` /
  `courier_name` as `bookedService`. Core's `bookedCourier` already records a swap and notes it
  on the order.
- After the AWB, the adapter reads the charge from `GET /orders/show/{order_id}`
  (`data.awb_data.charges`: `freight_charges`, else `applied_weight_amount`, plus `cod_charges`).
  It returns that as `chargePaise`. The read is best-effort: if it fails, or Shiprocket has no
  freight yet, no charge is saved and the merchant types it in Profit. A pushed order is read by
  Shiprocket's own numeric order id (`pushed.externalOrderId`), never our UUID.
- `ShiprocketProvider.quoteIsCharge = false`, so the quote is never saved as the charge.
- Core (`packages/core/src/shipping/booking-truth.ts`): when no courier was picked and the
  aggregator names the one it chose, the shipment is saved as "Blue Dart Surface (Shiprocket)"
  with its carrier. This is not a swap, so no order note.
- Not yet checked: the `orders/show` charge field names come from Shiprocket's API collection,
  not from a live account. Whether `freight_charges` already includes COD is not confirmed. Check
  on the first real booking: compare the saved charge with the Shiprocket wallet debit.

## 2. COD amount

- What was wrong: `/orders/create/adhoc` got only `sub_total` = the parcel's value. Shiprocket
  collects `sub_total + shipping_charges + giftwrap_charges + transaction_charges -
  total_discount`, so the COD amount from Create shipment (`codAmountPaise`) never reached
  Shiprocket. A COD fee, or a part already paid, was ignored.
- Now `packages/shipping-shiprocket/src/amounts.ts` (`orderAmounts`, the same approach as
  RapidShyp's `amounts.ts`) sends these fields:
  - `sub_total`: the items.
  - `shipping_charges`: how much the parcel's value is above the items.
  - `transaction_charges`: how much the COD amount is above the value (a COD fee).
  - `total_discount`: how much the value is below the items (a coupon), plus how much the COD
    amount is below the value (already paid, e.g. store credit). Shiprocket has no field for an
    amount already paid.
- Shiprocket's total then equals `codAmountPaise` on COD and the value on prepaid. Return orders
  are unchanged (prepaid, `sub_total` = value).
- Found, not changed: the default COD amount upstream is still the parcel's value. This applies
  to the Create shipment prefill (`flow-state.ts`), bulk ship, and core `createShipmentForOrder`.
  A COD order that has store credit captured (an admin draft converted with part paid by credit)
  is prefilled at the full value, for every courier. The adapters now send whatever amount is
  given. Taking captured payments off the default is a separate, all-courier change.

## Tests

- `packages/shipping-shiprocket/test/booked-cod.test.ts`: amounts (prepaid, COD with coupon and
  fee, COD with store credit), the payload, booked courier and charge, a failed or empty charge
  read, a pushed order's id, and `quoteIsCharge`.
- `packages/core/src/shipping/booking-truth.test.ts`: the courier an aggregator chose is named,
  and a `quoteIsCharge: false` quote is not kept.
