# RapidShyp: approve the order to get its shipment id (picked courier)

Booking a picked courier on RapidShyp sends `create_order` (no courier), then `assign_awb` with
that courier's code. `create_order` answers `shipment: []`, so until now the order was left on
RapidShyp for the merchant to assign the courier by hand.

RapidShyp support (16 Nov 2026): "After using the create_order API, use the approve order API.
In the response payload, you can find the shipment ID. Also wrapper API doesn't take the courier
code, it works on the priority set."

- `booking.ts`: with no shipment id in the create answer, `approve_orders`
  (`{ order_id: [ref], store_name }`) is called and the id is read from wherever it sits in the
  answer (`anyShipmentId`; the docs page shows only `{ status, remark }`). A failed approve is
  reported in the error reason, then Track Order is asked as before; only if both find nothing
  is the order left on RapidShyp with the old message.
- Wrapper unchanged (books by the account's courier priority, as support confirmed).
- Not yet tried on the live account: the first real check is the next picked-courier booking.
