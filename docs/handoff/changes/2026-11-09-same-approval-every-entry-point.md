# One approval rule for every entry point (cancel from the orders table)

Fixes #1409.

- Root cause: role approvals are decided once, in `storeProcedureWith`
  (`packages/api/src/procedures/store.ts`), from the procedure's own `can(permission)`. The
  orders table's "Cancel order" called `orders.setStatus` (`can(orders.write)`) with
  `orders.cancel` checked inside the handler, so the Administrator's default `orders.cancel` tick
  was skipped and the cancel ran at once; the order page's `orders.cancel` waited, as intended.
- New: `can(permission, also)` / `canAny(list, also)`. `also` (`AlsoNeeds`,
  `procedures/also-needs.ts`) names the grants some inputs need on top; the middleware refuses
  without them and queues when the role ticks one, before the handler runs. In-handler checks
  moved onto procedures: `orders.setStatus` cancelled → orders.cancel; `orders.cancel` /
  `orders.edit` refunding → orders.refund; `orders.updateContact` saving to the customer →
  customers.write; `products.bulk` delete → products.delete (it needed only products.write
  before: a permission hole too); `products.bulkEdit` stock → inventory.write;
  `returns.exchange` → drafts.write; Automations on a Growth workflow → marketing.write / send;
  `metaobjects.setMetafields` → the record's write grant.
- Admin: the orders row menu's "Cancel order" now opens the order page's `CancelOrderDialog`
  (`orders.cancel`: refund, restock, notify), shown by the same rule (`canStaffCancel`, not
  shipped) and grant. The bulk bar's "mark as cancelled" counts approval-held orders as sent, not
  failed (`isApprovalQueued` in `lib/api-client.ts`). Unused `orderDetail.cancelDialog` copy gone.
- Guard: sweep `handler-grants` (docs/guardrails.md, y). Tests: `packages/api/test/mcp-actions.test.ts`
  → "every entry point asks the same".
- Left alone: "Mark as fulfilled" (`orders.setStatus`, orders.write) vs booking a shipment
  (`orders.fulfil`, orders.fulfil) are different changes; giving marks the fulfil grain would
  tighten roles, an owner decision.
