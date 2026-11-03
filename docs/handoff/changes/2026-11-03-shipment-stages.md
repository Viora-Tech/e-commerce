# Inbound shipment stages: Planned and Cancelled (#1056)

- Statuses are now `planned → in_transit → at_port → cleared → delivered`, plus `cancelled`
  (`INBOUND_SHIPMENT_STATUS_VALUES` in db and `INBOUND_SHIPMENT_STATUSES` in core, kept equal by
  the existing test). Migration **0220_shipment_stages** replaces `inbound_shipment_status_check`.
- `in_transit` is labelled **Shipped** now (was "On the way"); chips: Planned neutral, Cancelled
  error. New shipments start as Planned in the form (the API default stays `in_transit`).
- Mark as delivered is hidden on cancelled shipments (page header and row menu). Bulk
  "Change status" picks the new stages up automatically. Merchant guide has a Stages section.
- Also moved `purchaseOrderBulkContent` from `data/inventory.ts` to `data/purchasing.ts` (en + hi): #1069 left inventory.ts at 501 lines and failed the file-size sweep.
