# RapidShyp: say what Track Order answered

- Owner, 14 Nov 2026: after #1682 the booking still said "created order 2471-3 but sent back
  no shipment id". The Track Order lookup found nothing, and its answer was not kept.
- Each lookup round now asks Track Order by order id alone, then with the receiver's 10-digit
  phone (a `+91` number may not match). When no shipment id turns up, the staff message ends
  with what create_order answered (remark, fields, `shipment`) and what each Track Order ask
  answered (success, msg, records, shipments, or the error), so the next attempt shows the cause.
