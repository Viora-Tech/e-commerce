# Pickup address falls back to Store details (#1464)

`packages/core/src/shipping/ship-from.ts`: when Settings › Shipping's dispatch address has no
street, the store-wide ship-from uses Settings › Store details' address and phone (state as its
code), but only when that PIN is the dispatch PIN (or no dispatch PIN is set). Applies to every
`shipFromFor` caller (bookings, quotes, returns, India Post). Create shipment's default pickup
card shows the same address (`create-shipment.service.ts`). Tests in `ship-from.test.ts`.
