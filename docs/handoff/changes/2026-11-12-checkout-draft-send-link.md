# Send payment link from a shopper's checkout draft (#1608)

Branch `feat/checkout-draft-send-link`. No migration.

- **Admin:** `components/drafts/checkout-draft-view.tsx` has a "Send payment link" button (open,
  unexpired checkout draft with an email or phone). It opens the shared
  `orders/send-message-dialog.tsx` on the `draft_invoice` template with its own title and Send
  label (`labels`), and Email / WhatsApp / Both (`chooseChannel={{}}`). `chooseChannel.onChatOpened`
  is now optional: without it the dialog shows no "Open in WhatsApp" hand-sent fallback.
  The rate-limit toast is read from the API's `TOO_MANY_REQUESTS` data by
  `components/drafts/checkout-draft-send-link.ts` (tested). Copy: `checkoutDraftContent`
  (`sendLink`, `sendLinkButton`, `linkSent`, `linkTooSoon`) with the Hindi overlay.
- **API:** `orders.sendPaymentLink` (`routers/order-drafts.ts`, `DRAFTS_WRITE` like Send invoice):
  `{ id, custom?, channel? }`. `storeHasWhatsapp` is now exported from `routers/order-messages.ts`.
  `getDraft().timeline` now shows every note except the staff draft's own note (`author = 'draft'`),
  so staff-written lines show beside the system ones.
- **Core:** `order/checkout-draft-pay-link.ts` → `sendCheckoutDraftPayLink`: locks the draft row,
  narrows the channel to what the draft and the store have (`reminderChannelFor`, now exported from
  `payments/manual-followup.ts`), refuses a channel used in the last 10 minutes (`PayLinkTooSoon`,
  counted from the timeline lines), then writes a `draft.invoice_sent` outbox event (`requires` for
  one channel) and the line "Payment link sent by email and WhatsApp by <staff>".
- **Delivery:** no new template. `notifications/draft-invoice-link.ts` decides the `draft_invoice`
  link for both delivery and the preview: a checkout draft links its signed order page
  (`thankYouUrl`, the same link as "Copy payment link"; the invoice page refuses checkout drafts),
  always reads as the "still waiting for your payment" reminder wording, and is dropped once the
  draft was paid, converted or expired. Staff drafts are unchanged. Email suppression applies as for
  every store email (the channel guard); it is a transactional message.
- **Owed:** browser check of the dialog on a checkout draft (email only, phone only, both, and the
  second send inside 10 minutes). No real email or WhatsApp was sent.
