# Purchase orders: edit an order on a shipment until goods arrive; Duplicate (#1059, #1060)

- **Edit after confirming (#1059):** lines on a sent order were already editable until goods
  arrive, except when the order was on an inbound shipment (core `PO_IN_SHIPMENT`, admin locked
  the lines). Now an order on a shipment can change products, quantities and prices while nothing
  on it has arrived; saving locks the shipment's costing group and re-splits its shared charges
  (`recost`). Once anything arrived (received or rejected), the old refusal stays. Admin notice:
  `inShipmentEditable` vs `inShipment`.
- **Duplicate (#1060):** `duplicatePurchaseOrder` (core) → `purchaseOrders.duplicate`; the ⋯
  menu's **Duplicate** opens the new draft: same supplier, destination, currency, rate, name,
  note and lines (deleted products left out); no shipment, receipts, charges or expected date.
- Tests: core purchasing "orders on a shipment, and duplicates", and the old shipment-lock test
  now checks the new rule. Merchant guide Stock → Purchase orders. MCP action docs regenerated.
