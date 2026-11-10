# Delhivery: send box dimensions when booking (#1462)

`packages/shipping-delhivery/src/delhivery.ts` `buildShipmentPayload`: `shipment_length`,
`shipment_width`, `shipment_height` (cm) from `input.dimensionsCm` when known (left out
otherwise). Forward bookings only; reverse pickups unchanged. Test in `delhivery.test.ts`.
