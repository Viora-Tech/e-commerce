# Emails: "WhatsApp us" button and the order's invoice (22 Nov 2026)

## WhatsApp us

- New shared block `whatsapp` (`packages/notifications/src/emails/blocks/contact.tsx`): WhatsApp
  logo + "WhatsApp us" in a green-outlined pill, linking to `https://wa.me/<digits>`.
- Number: the store's phone (Settings, Store details; `store.contact_phone`, already sent as
  `brand.supportPhone`, the same number the help box uses). No number, no button.
- Logo: hosted PNG `apps/storefront/public/email/whatsapp-green.png` (the existing footer icon
  recoloured to WhatsApp green), loaded from the store's own domain like the other email icons.
  No SVG. Without a shop URL (platform previews) the pill shows the label alone.
- Composer helper `whatsappButton(d)` in `templates/compose/contact.ts`. Used by Payment received
  and Order placed (with "Questions about your order?" line) and Order shipped.
- Copy: `blockCopy.contact` in `templates/content-blocks.ts`. Emails have no Hindi overlay (the
  notifications package is English only; Hindi overlays exist for admin copy only).

## Invoice in emails

What existed: the GST invoices app already attaches the issued invoice PDF to Payment received
and Order shipped (setting "Attach to email" on the tax invoice) and adds signed per-document
"Download invoice" links ("Link in emails", `emailLink`). Why it was missing: the app issues the
invoice when it hears `order.paid`, and the worker queues that app event at the same time it
sends Payment received, so at send time there is no issued invoice to attach or link.

Chosen: keep the PDF attachment (SES sends attachments) when the invoice is already issued
(Order shipped usually), and for Payment received add a **"Download invoice" link signed for the
order**, resolved when the shopper clicks:

- `orderInvoiceLinkPath` / `verifyOrderInvoiceLink` in `packages/invoices/src/link.ts`: HMAC over
  store, `order:<id>` and a 30-day expiry (same key as document links; a document token never
  opens an order).
- Storefront route `apps/storefront/src/app/-s/[storeId]/documents/order/[orderId]/route.ts`: one
  issued invoice serves its PDF; a split order (one invoice per GSTIN) lists each signed link; none
  yet says it is being prepared. No sign-in; works only for that order.
- `plugin-gst-invoices/src/links.ts`: adds the order link only for Payment received, only when
  the tax invoice is on, `emailLink` is on and `issueOn` is `payment` (pre-orders only with
  "invoice pre-orders at payment"). Issued invoice links now carry `kind: 'invoice'`.
- `OrderLink.kind` and `OrderLinkContext.template` (`packages/plugins/src/types.ts`); the worker's
  `appEmailExtras` passes the template.
- Emails: `invoiceFile(d)` draws the `kind: 'invoice'` link as the PDF file block with
  "Download invoice" in Payment received, Order placed and Order shipped; `renderEmail` no longer
  lists a link a file block already shows.
- Order confirmation (Order placed) gets no new invoice link: for unpaid and COD orders no invoice
  exists yet, and prepaid orders get Payment received right after. The existing "Order
  confirmation" PDF switch still attaches that document.

## Tests

- `packages/notifications/test/contact-blocks.test.ts` (new), plus `blocks`, `templates`: run, pass.
- `packages/invoices/test/helpers.test.ts` "order invoice links": run, pass.
- Not run: the storefront route and the plugin's `orderLinks` (need a database / dev server).
  Check on localhost: pay an order with GST invoices installed, open "Download invoice" from the
  Payment received email before and after the invoice is issued.
