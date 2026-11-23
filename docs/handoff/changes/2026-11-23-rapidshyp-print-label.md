# RapidShyp Print label (23 Nov 2026)

**Bug:** on the live store, Print label for a RapidShyp shipment gave no file.
`shipments.labelSheet` answered 200 in 23 ms, so no label was fetched at all.

**Root cause:**
- At booking, `finishBooking` (packages/shipping-rapidshyp/src/booking.ts) kept the label link
  from the wrapper's `labelURL`, or else from a best-effort `generateLabel` whose errors were
  swallowed. When neither gave one, the result had no `labelUrl` and no `labelViaProvider`.
  `createShipmentForOrder` (packages/core/src/shipping/shipments.ts) then saved the shipment
  with `labelUrl` null.
- `collectLabelFiles` skips a null `labelUrl` as `no_label` before anything is read. That is the
  quick 200 with no file ("None of these labels is ready yet"). `shipmentLabelUrl` also gave
  null, so the single Print label had no link either.
- RapidShyp had no `getLabel`, so nothing could ask for the label later. The wrapper's link is
  not trustworthy either: its documented sample is `https://rapidshyp_labels/...`, which is not
  a real host, and safeFetch fails on it straight away.

**Fix:**
- `RapidshypProvider.getLabel(waybill)` finds the shipment id by AWB through Track Order (the
  lookup from e7551a08c, now the private `shipmentIdByAwb`). It then asks the Label PDF API for
  the link and returns the PDF behind that link. A file that does not start with `%PDF` is
  refused.
- `generateLabel`: RapidShyp's docs say GET with a JSON body, which `fetch` cannot send. It
  still posts the body. If the POST answers 404 or 405, it asks again once as a GET with
  `?shipmentId=`.
- Booking with no `https` link now returns `labelViaProvider: true`, so the row is saved with the
  admin's label route.
- Read time (packages/core/src/shipping/shipment-state.ts): `labelOnDemand('rapidshyp')`.
  `shipmentLabelUrl` sends every RapidShyp shipment that is not cancelled to the admin's route,
  whether it has a saved link or not. Label sheets map their rows the same way.
- If `getLabel` fails, label sheets and `shipmentLabelFile` fall back to the public link saved at
  booking. The shared fetch is in `packages/api/src/services/label-link.ts`.
- The bulk booking result returns `shipmentLabelUrl(row)`.

**Existing shipments:** no rebooking and no data change. The rule works at read time, so after
release every RapidShyp shipment that is not cancelled prints through `getLabel`.

**Tests:** `packages/shipping-rapidshyp/test/rapidshyp.test.ts` › getLabel (fetch mocked):
lookup by AWB, the GET retry, refusals (no shipment, no label, not a PDF), and booking with no
link. `packages/core/src/shipping/shipment-state.test.ts` covers the on-demand rule.
