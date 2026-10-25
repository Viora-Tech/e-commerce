# Orders → Shipments to Figma (tabs, wallet strip, Book selected)

Branch `feat/admin-shipments-workspace`. No migration.

- One table with the Figma tabs To book / Booked / In transit / Delivered / Returned (RTO);
  columns Order (+ when), Ship to (+ city, PIN), Courier, Weight, Status. Tab statuses live in
  `@commerce/core/shipment-tabs` (`SHIPMENT_TAB_STATUSES`), shared by the API and the admin.
- API: `shipments.counts` (rows per tab, booked today, NDR pending); `shipments.list` gains
  ship-to, weight and order-number search; `readyToShip` gains weight (sum of variant weights)
  and order-number search.
- Header: ⋯ (Book by order number, for COD orders), Pickups (sheet with the old Pickups tab),
  Courier settings, and the key **Book selected** (controlled selection: `ResourceTable` gained
  an optional `selection` prop). "N need attention" in the summary opens the NDR sheet.
- Wallet strip only for couriers with a balance API (Shiprocket); Delhivery/RapidShyp show no
  strip (no balance API), so the manual "record balance" form is gone.
- Removed: ready-to-ship-tab, shipments-tab, rto-tab (30-day RTO tiles), wallet-card(s),
  no-courier-banner. Empty state "Connect a courier" → Apps.
