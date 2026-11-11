# Shiprocket: cancel a booked shipment by AWB (#1567)

- `packages/shipping-shiprocket/src/shiprocket.ts` `cancel` (logic in `src/cancel.ts`) now calls
  `POST /orders/cancel/shipment/awbs` with `{ awbs: [awb] }`. A 4xx (other than 401/403/429) and a
  2xx body with `status_code` >= 400 or non-empty `errors` become `CourierError('rejected')` with
  Shiprocket's reason; auth, rate limit, 5xx, timeout and non-JSON keep their kinds.
  `cancelPushedOrder` (`/orders/cancel`, pending orders) is unchanged.
- The app now declares `cancel` (`src/client.ts`), so Shipments offers **Cancel shipment**.
- Shared interface: `ShippingProvider.cancel(waybill, ref?)` takes an optional `CancelRef`
  (`{ waybill, providerRef }`, `packages/shipping/src/types.ts`). Core's `cancelShipment` still
  passes `providerRef || waybill` first (RapidShyp cancels by its order id) and now the row's own
  AWB as `ref`. Shiprocket stores its shipment id in `providerRef`, so it reads `ref.waybill`.
  Other couriers ignore the second argument.
- Tests: `packages/shipping-shiprocket/test/shiprocket.test.ts` (faked fetch, no real calls);
  `packages/core/src/shipping/shipments.test.ts` checks the ref is passed.
- **Owed:** one live test on a test booking (the success body is undocumented beyond a message),
  and a browser check of the Cancel action. Merchant guide (Couriers › Shiprocket) says so.
