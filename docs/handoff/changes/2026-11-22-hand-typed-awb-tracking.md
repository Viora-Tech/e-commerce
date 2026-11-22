# Hand-typed AWBs of a connected courier are tracked again

**What:** packing an order by hand with a tracking number and a courier picked from the list
("Delhivery") saved the shipment under the bare name `Delhivery`. The tracking poll and Cancel
look couriers up by app id (`delhivery`), so such parcels were skipped silently: #2462 stayed at
"Label created" for a week after Delhivery delivered it on 15 Nov, and its shipment card said the
courier "does not take cancellations from here".

**Fix:** `orders.fulfil` now saves a hand-named courier under its connected app when the name
matches the app's id or label (any case) and the app is connected
(`connectedCourierApp` in `packages/api/src/services/order-fulfil.service.ts`). Couriers without
an app (India Post, other) keep their name as before.

**Existing rows:** shipments already saved under a name (`provider = 'Delhivery'`) are not
changed by this; moving them to `delhivery` is a one-off live data fix that needs the owner's OK.

**Tests:** `packages/api/test/connected-courier-app.test.ts`.
