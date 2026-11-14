# One courier booking per parcel, even on a double "Ship now"

- Owner, 14 Nov 2026: "what if I click Ship now and my page refreshes by mistake". The booking
  carries on on the server. But a second click while the first was still with the courier found
  no shipment yet and booked a second label.
- `createShipmentForOrder` (core shipping) now locks the order row (`for update`) for the booking
  transaction. A second booking of the same order waits, then finds the first and reuses it.
- `shipping/one-booking.test.ts`: two bookings at once give one courier call and the same
  shipment (it books twice without the lock).
