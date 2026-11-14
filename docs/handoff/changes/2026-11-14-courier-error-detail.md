# Staff see why a courier booking failed

- Owner, 14 Nov 2026: a RapidShyp booking said only "The courier answered with an error."
- `describeCourierFailureForStaff` now returns our own sentence for a `bad_response` too
  ("RapidShyp created order 2471 but sent back no shipment id… cancel it there before booking
  again"), not just for a `rejected` one. Shoppers still never see it.
- `shipping.service.ts` logs `courier booking failed` with provider, kind, status, the courier's
  reason and what staff were shown, so the log has more than "BAD_REQUEST".
