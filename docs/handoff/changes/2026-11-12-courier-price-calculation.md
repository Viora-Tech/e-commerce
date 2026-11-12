# Courier price worked out in Create shipment (12 Nov 2026)

Owner: "We don't see how everything is calculated, the divide of things, when I select a
courier." Owner chose "Full calculation".

- New pure helper `apps/admin/src/components/shipments/create-shipment/price-calculation.ts`
  (`priceCalculation`, `weightCalculation`) and its view `price-calculation-list.tsx`. The picked
  row in the Select courier drawer (`courier-table.tsx`) and the picked option in the older list
  (`courier-option.tsx`, used by `courier-step.tsx` and `bulk-edit-dialog.tsx`) show:
  - **Weight**: dead weight, volumetric (L × W × H ÷ 5000, `VOLUMETRIC_DIVISOR`, now exported
    from `@commerce/core/parcel`), which one is charged (the higher), and the courier's own
    charged weight when it differs ("as charged by the courier"). The page passes the typed
    package (`parcel` prop through `CourierDrawer` / `CourierStep`); bulk edit has none, so only
    the courier's weight shows there.
  - **Courier charges**: its itemised lines (freight, fuel, COD, insurance, RTO, other, GST), or
    one "Courier's total (incl. GST)" line when it gave a total only (RapidShyp; Shiprocket
    without parts). Never split by us. A gap between parts and total is shown: "Rounding" up to
    ₹1, else "Not itemised by the courier (incl. GST)" (Shiprocket's parts leave GST out).
  - **Shipping insurance** (switch on, `rowInsuranceState` = `added`): `rate% × ₹value = fee`,
    `+ 18% GST`, or "incl. GST" (Shiprocket), "estimate" (RapidShyp); a route minimum shows as
    "Route's minimum fee". A courier's own insurance line (`included`) is not added twice.
    "Insurance rate not set" when `unset`.
  - **Total you pay** = the row's price; the lines always sum to it (unit-tested).
- Core: `InsuranceQuote.rateBps` / `RowInsurance.rateBps` (the rate the fee was worked out at:
  Protect's category rate, the route's %, RapidShyp 89 / Shiprocket 105; null for a quoted
  line or when the route's minimum applied), so the drawer prints the rate without working it
  out again. `RowInsuranceState.added` carries it.
- Copy: `createShipmentContent.calculation` (English + Hindi). Removed the old breakdown keys
  (`drawer.breakdown/youPay/insuranceGst/insuranceInclGst/insuranceEstimate`,
  `courier.breakdown/total/chargeableWeight/noBreakdown`).
- Merchant guide: `orders/shipments.mdx`, Courier step.
- Tests: `price-calculation.test.ts` (Delhivery itemised + Protect, RapidShyp total + estimate,
  Shiprocket total incl. insurance, Shiprocket parts gap / rounding, no double count, volumetric
  vs dead weight); `protect.test.ts` (rateBps, route minimum).
