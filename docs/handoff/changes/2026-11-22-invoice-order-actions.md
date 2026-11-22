# GST invoices: order actions follow the invoice (22 Nov 2026)

Owner's report: an order with an issued tax invoice still showed "Generate GST invoice" and "Add
to invoice queue" under More actions → Apps.

## What changed

- **SDK: app order states.** An order action can carry `whenState: ['invoiced']` or
  `['!invoiced']` (`packages/plugins/src/types.ts`). The states come from the app's new
  `orderStates(ctx, orderIds)` read on the manifest, asked a page of orders at a time.
  `definePlugin` refuses a `whenState` without an `orderStates` read or with a bad name. Like
  `requires`, the detail page and row menus hide a gated action when the states do not match
  (and while they are still loading); the bulk bar ignores them.
- **API:** `apps.orderStates({ orderIds })` (up to 100, `orders.read`): only installed, set-up
  apps with a gated action are asked, each in a savepoint (a failing read hides that app's gated
  actions, nothing else). `gstInvoices.emailInvoice({ orderId })` (`orders.write`).
- **GST invoices states** (`packages/plugin-gst-invoices/src/order-states.ts`, two statements per
  page): `invoiced` when every live parcel has an issued tax invoice and none waits in the queue;
  `invoice-pdf` when one issued invoice is ours; `invoiced-outside` when all issued ones were
  recorded with "Already invoiced" (Shopify-era orders).
- **Menus:** Generate GST invoice and Add to invoice queue show only without `invoiced` (a split
  order with one parcel still to invoice keeps them). New "Email invoice to customer" and
  "Download invoice" show with `invoice-pdf`. A recorded "Already invoiced" order shows none of
  the four (no PDF to send). Bulk "Add to invoice queue" is unchanged and still counts the
  orders already invoiced.
- **Email:** the existing `email` job (moved to `src/email-documents.ts`, same `document_copy`
  email the Invoices list's bulk Email sends) now notes each send on the order timeline ("Tax
  invoice INV/.. emailed to the customer.", by the member who asked). `emailInvoice` refuses an
  order without an email address or without an invoice PDF. It sends whatever the "Attach to
  email" switch says: that switch is for the automatic order emails, this is a manual send.
- **Download invoice** saves each issued invoice PDF of the order (one per parcel).
- Admin: `useOrderAppStates` (`apps/admin/src/components/orders/use-order-app-states.ts`) asks
  for the states of the orders on screen, again after an action ran or when the Invoices card
  changes something. Copy in `data/order-app-actions.ts` + Hindi.

## Tests

Run, pass: `packages/plugin-gst-invoices/test/order-states.test.ts` (new, database),
`packages/plugins/test/order-actions.test.ts`, `apps/admin/src/apps/order-actions.test.ts`;
typecheck of plugins, plugin-gst-invoices, api, admin.

Check on localhost: an invoiced order's More actions shows Email and Download, not Generate; an
"Already invoiced" order shows neither; Email puts a line on the timeline.
