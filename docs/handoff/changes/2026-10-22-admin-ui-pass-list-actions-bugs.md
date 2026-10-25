# Admin UI pass: list actions, email review, Home numbers, draft pay page

Owner-led UI review on dev (21–22 Oct 2026). Bug list with statuses: the "Koomerce Admin – Bugs Found by Page" doc.

## Layout and polish
- Sticky right columns (`page-columns`, `proofly-detail-page`, `order-page-frame`, shipment summary): height
  cap accounts for the top bar, cards no longer shrink (`[&>*]:shrink-0`), so the column scrolls to its end.
- Less top padding on every page (`PageBody` and the pages with their own `py-8`); Home `md:pt-5`.
- 313 action buttons got icons (icon first, `aria-hidden`); Archive, Pause, Play, UserPlus, Tag, Unlink
  added to `packages/ui/src/icons-more.tsx`.
- Settings rail shows each section's icon and sorts each group by the shown name's length.
- Login: carousel 8 s per slide; OTP submits at six digits (admin and storefront checkout). Waitlist card no
  longer stretches.
- Payment gateway page, Shopify style: a "Test mode" card with one switch (`gateway-switches.tsx`) and a red
  Deactivate at the bottom right (`MainGatewayCard layout="page"`). The Payments overview card keeps the chip.

## Row ⋯ and bulk actions on every list
Orders (next move, payment reminder, copy number, shipments, tags; bulk tags via new `orders.tagMany`,
reminders, CSV export, packing slips at `/orders/packing-slips?ids=`), drafts (send invoice, bulk
`orders.sendInvoices`), abandoned checkouts (bulk recovery), shipments (bulk pickup/manifest), returns,
products, collections, gift cards, purchase orders, transfers, inbound shipments, suppliers, customers,
segments, discounts, campaigns, automations, links, blog posts, pages, reviews. Looped bulk calls go through
`lib/run-batched.ts` (10 at a time, one summary toast). Destructive and customer-messaging actions confirm.

## "Review email" before hand-sent messages
`components/orders/send-message-dialog.tsx`: recipient, editable subject, optional custom message, live
preview (`orders.previewMessage` / `orders.previewRecovery`, core `notifications/preview.ts`). Used by draft
invoices, balance requests, payment reminders and checkout recovery. The edits travel as `custom` on the
outbox payload → notification job → `TemplateData.custom` (subject override; note under the intro, and at the
top of the WhatsApp text). WhatsApp tab only when a WhatsApp channel is connected.
Development without the platform email account now falls back to the log channel (`sender-email/channels.ts`)
instead of refusing every send.

## Home numbers (data audit A1–A7, B4, B7, B8)
Goal ring counts the whole month; running ranges compare against the same elapsed time; abandoned tile uses
the Abandoned page's rule; refunds skip test orders; "Ship N orders" uses the Unfulfilled list's own rule
(`viewFilter('unfulfilled')`, imported orders out, COD in) and its "Waiting N days" skips pre-orders waiting
on stock; new `balance_due` order view for the pre-order balance to-do; best seller copy says 30 days;
returning = distinct customers; Finish setup keeps Payments open while on test keys.

## Draft invoices can be paid online
Invoice emails carry a signed 30-day "Pay securely" link (`invoiceUrl`, purpose `draft-invoice`) to
`/checkout/invoice/[token]` on the storefront: items, total, Pay. Pay converts the draft
(`convertDraftForOnlinePayment`: same convert as admin, its placeholder payment replaced by a gateway
attempt, `order.placed` emitted) and opens the store's online gateway; a second tap retries the payment.

## Storefront checkout
Razorpay script loads once (it was re-added on every render), `payment.failed` is handled, and Razorpay's
leftover overlay and scroll lock are cleared when its window closes.
