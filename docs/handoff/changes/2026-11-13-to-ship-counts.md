# Sidebar counts: Orders counts orders, Shipments counts To ship rows (13 Nov 2026)

Since partial shipments (#1640) the To ship tab lists one row per open parcel, but the sidebar put
the orders-waiting number on both Orders and Shipments. `store.shell` now returns
`toShip: { orders, parcels }` (one extra count query in the same transaction, only with
`orders.read`); the Orders entry shows orders waiting, Shipments shows the To ship rows.
