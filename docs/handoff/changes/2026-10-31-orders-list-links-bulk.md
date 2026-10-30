# Orders list: real links, items popover, tracking chip, bulk mark skips (#1008, part of #1007)

Pushed straight to `dev` (branch `agent/orders-list`). No migration.

- **Order number is a link** (`lib/order-columns.tsx`, `next/link`): middle-click or Ctrl-click
  opens the order in a new tab; a plain click on the row still opens it in the same tab. The
  link stops the row's click so Ctrl-click does not also navigate the current tab.
- **Items popover** (`components/orders/order-lines-popover.tsx`): "+n more" under the first
  product on multi-item rows has an arrow and opens a popover with each item's picture, title,
  variant and quantity. Lines load on first open from the new `orders.linePeek` route
  (`listOrderLinePeek` in `packages/api/src/services/order.service.ts`, up to 20 lines).
  Clicks inside the portalled popover stop propagation so they never reach the row.
- **Tracking chip**: `orders.list` now returns `trackingUrl` (latest shipment). When it is an
  http(s) address the Delivery chip is an `<a target="_blank" rel="noopener noreferrer">`.
- **Delivery and Tags columns** show by default (tags: two chips, then "+n").
- **Bulk "Mark as"** (`orders-page.tsx`): cancelled and imported orders on screen are skipped
  without a call, the API's BAD_REQUEST refusals count as skipped, real failures as failed;
  one toast reports updated / skipped / failed. Before, one cancelled order failed the batch.

## Left out of #1007

- **Archive / Unarchive**: orders have no archive concept yet (no `orders.archived_at`, no
  service, no route). Needs a migration, a core service, a bulk route, a list filter and a
  detail banner. Waiting on the owner.
- **Mark as unfulfilled**: no safe service path exists (it would have to undo packed lines and
  shipments). Not built.
- **Change fulfilment location**: out of scope (owner). **Print invoices** already existed in
  More actions. **Delivery method column**: not added (owner).

## Test

On `/orders`: middle-click an order number (new tab), Ctrl-click (new tab, current tab stays),
plain click a row (same tab). On a row with 2+ items click "+n more ⌄". On a shipped order with
a courier tracking link, middle-click the Delivery chip. Select a cancelled plus an open
unfulfilled order and Mark as > Fulfilled: one updated, one skipped in the toast.
