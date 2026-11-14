# RapidShyp: find the shipment id when create_order sends none

- Owner, 14 Nov 2026: "RapidShyp created order 2471-2 but sent back no shipment id, so Blue Dart
  Air (RapidShyp) could not be assigned." RapidShyp's documented create_order answer is
  `{ status, remarks, order_id, shipment: [] }`: no shipment id.
- Booking a picked courier (`bookChosen`) and pushing a pending order (`pushRapidshypOrder`)
  now look the shipment id up through Track Order by order id
  (`records[].shipment_details[].shipment_id`), up to three times over about 4.5 s, before
  `assign_awb`. Not found: the order just made is cancelled and staff are told, as before.
- `RapidshypConfig.wait` (tests only) replaces the pause between lookups.
