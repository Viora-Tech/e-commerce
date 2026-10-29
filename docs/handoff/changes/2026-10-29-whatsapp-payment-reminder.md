# Payment reminders on WhatsApp (#889)

Branch `feat/whatsapp-payment-reminder`. No migration.

- **Order page / row menu:** "Send payment reminder" dialog has **Send by** Email / WhatsApp /
  Both when the store has a WhatsApp channel (Meta Cloud API, `packages/notifications-whatsapp`)
  and the order has both an email and a phone (`components/orders/reminder-channel-picker.tsx`).
  Without a WhatsApp channel and with a phone: **Open in WhatsApp** (wa.me chat, reminder text
  with the payment link typed in) and a timeline note (`orders.notePaymentReminderChat`).
- **API:** `orders.sendPaymentReminder` takes optional `channel` (`email` | `whatsapp` | `both`,
  default both = old behaviour). Core narrows it to what the order and store have
  (`reminderChannelFor`), refuses with `ReminderNoRecipient` when nothing is left, and puts
  `requires` (`email` / `phone`) on the outbox row → notification job → `deliverNotification`.
  Preview returns `chatText` for stores without WhatsApp.
- **Timeline:** manual note now says the channel ("... on WhatsApp", "... by email and WhatsApp").
  The automatic "Remind unpaid orders" workflow now also adds a note ("Automatic payment
  reminder ..."), and no longer skips an order that has a phone but no email when WhatsApp is
  connected. Per-channel delivery rows (sent / failed) already show on the timeline.
- **Needs from the merchant:** an approved WhatsApp template named `payment_reminder`, category
  UTILITY, body params `{{1}}` customer name, `{{2}}` store name, `{{3}}` order number, `{{4}}`
  total, `{{5}}` payment link (`templateParams` in `notifications-whatsapp`). Without it Meta
  rejects the send and the timeline shows the WhatsApp delivery as failed.
- Tests: `payments/manual-followup.test.ts`, `automations/actions/executors.test.ts`,
  `outbox/relay.test.ts`.
