# WhatsApp click to chat everywhere

Branch `feat/whatsapp-click-to-chat`. **Migration `0183_customer_note`** (after #929's `0182_variant_price_optional`; merge after #929) (new `customer_note`
table, RLS applied, cascades with the customer).

Two separate WhatsApp features now:

1. **Send through our WhatsApp** (#924, unchanged): the store's connected Cloud API number sends
   the payment reminder (Send by Email / WhatsApp / Both). Only when WhatsApp is connected.
2. **Click to chat** (this PR): a wa.me link that opens the staff member's own WhatsApp (app or
   WhatsApp Web) with a prefilled, editable message. Needs no connection; shows whenever there is
   a phone.

- **Payment reminder dialog:** "Open in WhatsApp" now shows whenever the order has a phone, next
  to Send by when the store is connected (`reminder-channel-picker.tsx`). Preview `chatText` is
  always returned (also for the checkout recovery preview).
- **Click-to-chat dialog** `components/layout/whatsapp-chat-dialog.tsx` (centred): pick Payment
  link / Order confirmation / Shipping update / Abandoned cart / Blank, edit, "Open WhatsApp".
  Only messages whose link exists are offered (`lib/whatsapp-chat.ts`). Copy in
  `data/whatsapp-chat.ts` + `data/hi/whatsapp-chat.ts`.
- **Where:** order Customer details card and customer profile card (`ContactActions` `chat`
  prop: the WhatsApp button opens the dialog), abandoned checkout Customer card, draft order
  More actions → WhatsApp (saved draft with a phone).
- **API:** `orders.whatsappChat` / `orders.noteWhatsappChat` (`kind: order | checkout`; drafts are
  orders), `customers.whatsappChat` / `customers.noteWhatsappChat`. Core:
  `notifications/whatsapp-chat.ts` (`whatsappChatContext`, `noteWhatsappChat`). Links: draft →
  invoice link; open unpaid non-COD order → its signed order page (shows how to pay), preorder
  balance → balance link; order page; shipment tracking URL; checkout → recovery link. A customer
  uses their latest order's links (and its phone when they have none).
- **Timeline:** "Opened WhatsApp chat (<message>)." on the order (`order_note`) or customer
  (`customer_note`, shown in the customer Timeline card; `customers.get` returns `notes`). A guest
  checkout has no timeline, so nothing is noted.
- **Phone:** `whatsappNumber` in `lib/customer-contact.ts` strips spaces/dashes, a leading 0,
  `00`, and "+91 0", and adds 91 to a 10-digit mobile.
- Tests: `apps/admin/src/lib/customer-contact.test.ts`, `apps/admin/src/lib/whatsapp-chat.test.ts`,
  `packages/api/test/whatsapp-chat.test.ts`.
