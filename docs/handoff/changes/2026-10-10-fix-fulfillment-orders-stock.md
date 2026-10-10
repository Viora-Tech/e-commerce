# Fix: parcels made after the fact miscounted packed and cancelled stock

**Branch** `fix/fulfillment-orders-stock`, from `dev` after #362. No migration.

- **Bug**: `ensureFulfillmentOrders` (orders without a parcel, e.g. placed before 0096 or seeded
  by hand) ran inside the stock move, *after* `fulfilOrderLines` had already raised
  `order_line.fulfilled_quantity` and *after* `cancelOrder` had flipped the status. The parcel
  then copied the new packed count (so packing moved too little through the parcel and the rest
  through the selling row, in two ledger rows, and the shipment lost its parcel link) or was
  born cancelled (so cancelling released nothing: cancelled orders kept stock committed).
- **Fix**: `fulfil.ts` `lockOrder` and `cancelOrder` call `ensureFulfillmentOrders` before they
  change anything.
- **Tests run** (owner asked): core `src/order src/inventory src/returns src/shipping` 319/319,
  full core 1474/1474, db 30/30.
