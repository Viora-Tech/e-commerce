# Order page cards after the Shopify comparison (24 Nov)

Branch `feat/order-page-shopify-cards` (from `origin/dev`). No migration, no API change: the
admin order page only (`apps/admin/src/components/orders/`).

## What
1. **Fulfilled card** (`fulfilled-card.tsx`, drawn by `line-items-card.tsx`): status glyph on the
   left of the title, item count, the parcel number (`#1001-F1`, one-parcel orders only), then
   one line: shipped date · courier · AWB linked to tracking · shipment status, a rule, the
   products. "Mark as delivered" sits on the title row while the order is on its way, unless the
   next-step banner already shows it. The Shipment card keeps the scans but shows the latest 3
   with "Show all N scans".
2. **One Payment card** (`payment-card.tsx`, `payment-totals.tsx`, `payment-details.tsx`): the
   old money card in `line-items-card.tsx` and the Transactions card are one. Totals are three
   columns (label | muted note | amount; `TotalsList columns`) with rules before Total and
   before Paid by customer (`TotalsLine.rule`). GST is one "GST (included)" line that opens to the
   CGST/SGST or IGST split and "Billed from" (`TotalRow.tax` in `order-totals.ts`). Attempts,
   references, Capture, Refund, refunds and gateway events fold under "Payment details"; it opens
   by itself when an attempt needs a look (capture, refund owed, failed).
3. **Order lines** (`order-lines-table.tsx`): price paid then a "× n" pill. No struck-out price:
   `order_line` stores neither a compare-at snapshot nor a per-line discount share (the discount
   is order-level, and per parcel for GST). Showing it needs a snapshot column at placement.
4. **No duplicates** (`order-view.tsx`): the Ships from card shows only for several parcels or a
   pending stock transfer; one parcel puts "Ships from <location> · <rate>" at the top of the
   Unfulfilled card. The Shipment card is hidden until a shipment exists (a cancelled one still
   shows, to book again). Unfulfilled drops "Fulfil items" while the banner shows it.
5. **Side column** (`order-side-column.tsx`): Customer, then a read-only Notes card
   (`order-notes-card.tsx`, the checkout note or "No notes from customer"), then Where it came
   from and the rest as before. Customer card: no Name row; email and phone are plain lines
   copied on hover; Copy all for courier and Call / WhatsApp stay.

Unfulfilled, Fulfilled and Payment titles use `status-card-title.tsx` (tinted glyph on the
left). Copy: `orderStatusCardsContent`, `orderNotesCardContent` (`data/order-cards.ts`),
`items.gstIncluded`, `payment.details` (`data/order-detail.ts`), `showAllScans` /
`showFewerScans` (`data/shipping.ts`), all with Hindi.

## Not checked yet
Not opened in a browser: the owner checks it on localhost.
