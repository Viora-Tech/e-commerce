# 11 Nov 2026: Mark as fulfilled on a packed order (#1512)

An order whose courier bookings were all cancelled reads Unfulfilled (back in To ship,
`deriveFulfillmentStatus`) while its items stay packed. "Mark as fulfilled" opened the pack form,
which has nothing to pack and hides itself, so nothing happened (#2425).

- `order-view.tsx`: Mark as fulfilled (and the list's `?fulfil=1`) on such an order opens Create
  shipment instead (book again, or Ship it yourself with the courier and tracking), with a toast.
- `use-order-undo.ts`: Restore, Mark as unfulfilled / not delivered, Archive and Capture moved out
  of `order-view.tsx` (back under the 500-line cap); `?fulfil` / `?collect` read inline.
