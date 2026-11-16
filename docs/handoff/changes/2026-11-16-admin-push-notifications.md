# Push notifications for the team (admin)

Staff can get browser push on their phone or computer for the owner's four picks (16 Nov):
new order, new Inbox message, approval waiting, and problems (out of stock, payment keys refused,
sales-channel sync failed, Meta access ended, pixel stopped working).

- **Where:** Account → Notifications. A "Push on this device" card (Turn on / Turn off / Send a
  test) and a Push switch per alert, next to Email and WhatsApp. Push starts on for every push
  alert; nothing arrives until the member turns push on for a device. Role still decides what
  they may hear about (orders need Orders, Inbox needs Inbox, approvals go only to people who may
  approve, never to the asker; an AI app's request goes to its own member).
- **How it flows:** each event writes an outbox row (`inbox.message_received` and
  `approval.requested` are new); the relay queues `{push}-send` keyed by the row; the worker's
  `push.ts` sends with `web-push` (MPL-2.0, unmodified). `packages/core/src/push/` holds the
  wording (`messages.ts`), who gets it (`deliver.ts`) and devices (`subscriptions.ts`, the
  existing `member_push_subscription` table, keys encrypted). A gone device (404/410) is deleted.
- **Browser:** `apps/admin/public/push-sw.js` shows the push and opens the page on tap (same
  origin only). `app/manifest.ts` + icons make the admin installable: iPhones push only to a
  Home Screen app.
- **Setup:** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` on the admin AND the worker
  (`bunx web-push generate-vapid-keys`). Without them the Push column is hidden and the worker
  starts no push queue. No migration.
- **Not tested in a real browser yet:** Chrome would not open localhost pages through the
  extension, so the first real check is on admin.koomerce.app after deploy.
- Sweeps: file-size ratchet raised for `apps/worker/src/index.ts` and `packages/config/src/env.ts`
  (both were already over on dev).
