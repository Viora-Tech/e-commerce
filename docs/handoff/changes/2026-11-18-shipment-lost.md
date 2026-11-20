# Lost parcels on Shipments (18 Nov 2026)

Owner's case: a parcel the courier loses used to sit in In transit forever.

- New shipment status `lost` and a **Lost** tab (`SHIPMENT_TAB_STATUSES.lost`). Delhivery's `LT`
  scan (or any scan text "lost"), Shiprocket and Ekart "Lost" map to it; staff can also
  **Mark as lost** from the row menu on a parcel the courier has.
- A lost parcel keeps the order Shipped until **Reship**: the order goes back to To ship (still
  packed) to book a new label with any courier, same order, no new sale or invoice; the lost
  box's units leave stock again (`adjustStock`, reason `other`, note names the AWB). A shared box
  ("Same box as #A") is refused: duplicate each order instead.
- **Courier claim** per lost parcel: not filed / filed / paid / rejected, amount (prefilled from
  the courier's cover terms, `claimEstimatePaise`) and a note.
- **Check with courier** chip on a parcel on its way with no scan for 7 days (`STUCK_DAYS`).
- Ordinary scans keep a lost parcel lost; a delivered or RTO scan (found after all) moves it on.
  The tracker keeps asking about a lost parcel for 30 days (`LOST_TRACK_DAYS`; the
  `stores_with_open_shipments` function in 0255 matches), and Refresh tracking asks at once.
- Shoppers see a lost parcel as in transit.
- Migration `0255_shipment_lost.sql` (additive columns). Code: core `shipping/shipment-lost.ts`,
  `shipping/shipment-lost-state.ts`; API `routers/shipments-lost.ts`.
