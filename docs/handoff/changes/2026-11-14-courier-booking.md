# RapidShyp books the picked courier; aggregators get the order number

Branch `fix/courier-booking`. No migration.

Seen on Waimers on 14 Nov: Create shipment with "Blue Dart Air (RapidShyp)" booked Amazon Shipping,
then failed with "Awb can not assign with this shipment id", and nothing was recorded here.

- **Two-step booking**. The flow moved out of `rapidshyp.ts` into
  `packages/shipping-rapidshyp/src/booking.ts`, which keeps the file-size sweep green. The
  allowance for `rapidshyp.ts` is lowered from 910 to 797 lines. The wrapper books by
  the account's courier priority, and RapidShyp will not switch an assigned AWB. When a courier
  was picked, the order is now made with `create_order` (no courier), then `assign_awb` with that
  courier's code, then pickup and label. If the courier is refused, the RapidShyp order just
  made is cancelled. The error names the courier and ends with RapidShyp's remark in brackets.
  With no courier picked, the wrapper is still used. A pending (pushed) order gets
  `assign_awb` on its shipment and is left alone if that is refused.
- **Order number as the courier's order id**. RapidShyp (`orderId`) and Shiprocket
  (`order_id`) get `2471`, and `2471-2`, `2471-3` for the order's later bookings
  (`courierOrderRef` in `packages/shipping/src/order-ref.ts`). Core works out the new optional
  `CreateShipmentInput.shipmentNumber` in `courierShipmentNumber` (`core/src/shipping/order-push.ts`).
  It counts every shipment row of the order, cancelled ones included, plus one for a pending order
  at that courier that the booking does not reuse. If RapidShyp says "Order … already exists",
  the next suffix is tried, up to 4 ids.
- **What cancel and tracking use**. RapidShyp's `providerRef` is the id RapidShyp echoes back,
  or else the id we sent. Shiprocket still cancels by AWB, and `pushOrder` still keeps
  Shiprocket's own numeric order id. Its fallback stays the UUID, because `2471` would be read as
  Shiprocket order 2471. Shipments booked before this change keep their old UUID refs.
- **Refusal messages** (`packages/shipping-rapidshyp/src/remarks.ts`). Known RapidShyp remarks
  are put into plain words, with the raw remark in brackets: store name, pickup location, AWB
  already assigned, order already exists, wallet balance, not serviceable, PIN code, phone and
  weight. Unknown remarks are shown as before.
- `CreateShipmentInput.serviceLabel` (new, optional) is filled from the booking's service label,
  so messages can say "Blue Dart Air" and not the courier code.

Not confirmed against a live account: the exact `create_order` answer shape (the shipment id is
read from `shipment[0]`, a single object, or the top level) and the exact wording of the
"already exists" remark.
