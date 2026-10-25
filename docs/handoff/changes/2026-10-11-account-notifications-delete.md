# Account: personal Notifications and Delete my account

Branch `feat/account-notifications` (part 3 of 3 of the member Account area; #419 and #421
merged).

- **Notifications** (`/account/notifications`, `components/account/notifications-page.tsx`):
  per member, per store, by channel: new order, low stock, payment/payout problem, daily summary
  (hour of day, follows the 12/24-hour choice), app/integration errors. Stored as JSON on the
  member's own `store_member.notification_prefs` (RLS by store; procedures only ever touch the
  caller's row). Shape and defaults in `@commerce/core/member-account` (`alert-prefs.ts`): the
  owner starts with new order, payment problem and app errors by email; everyone else starts
  off; the daily summary is opt-in. WhatsApp switches show only when the store has a WhatsApp
  channel (`storeHasWhatsapp`) and are disabled until the member adds a mobile on Profile.
- **Wired** (`packages/core/src/member-account/alerts.ts`):
  - New order: the notifications worker, on the `order_placed` job's first attempt, calls
    `notifyMembersOfNewOrder` → `staff_new_order` (email and/or WhatsApp through the store's
    channels, logged in `notification`), link to the order in the admin (`ADMIN_URL`). Only
    members whose role holds `orders.read` (or owners). Never fails the customer's job.
  - Daily summary: new repeat job `{members}-daily-summary` every 10 min
    (`apps/worker/src/member-daily-summary.ts`), stores from the SECURITY DEFINER
    `stores_with_member_daily_summaries()`; sends `staff_daily_summary` at each member's IST
    hour, claiming `dailySummary.lastSentOn` in the same UPDATE so overlapping ticks never send
    twice. Before noon it covers yesterday, after noon today so far: orders, sales, to ship.
  - Both are store messages in the catalogue (group "Messages you get", switchable), so the
    owner can turn team alerts off for everyone in Settings → Notifications.
  - **TODO (saved, not sent yet; shown as "Soon")**: low stock, payment/payout problem,
    app/integration errors. Hook points: inventory threshold crossing, payment webhook
    failures / payout status, `reportWorkerFailures`/app-event failures. Use
    `alertMembers` + `deliverToMember` with a new template each.
  - WhatsApp alerts need the merchant's WhatsApp provider to have templates named
    `staff_new_order` / `staff_daily_summary` approved (params in `notifications-whatsapp`).
- **Delete my account** (Profile → danger zone, `delete-account-card.tsx` +
  `delete-account-dialog.tsx`): blocked with the store names while the member owns any store;
  otherwise type the sign-in email + a 6-digit code (Better Auth `createVerificationOTP`, type
  `email-verification`, emailed with the platform `account_deletion_code` template, printed in
  dev) → `account.deleteAccount` checks both, deletes the member's `store_member` rows in every
  store, their photo, then the `user` row (sessions, passkeys, sign-in log, memberships and
  invitations they sent cascade). Signs out, lands on /login. Code requests 3/hour.
- **Moved**: the sign-in log write from `packages/auth/src/sign-in-log.ts` (#421) to
  `@commerce/core` (`member-account/sign-ins.ts`, `recordMemberSignIn`), called through the new
  `MerchantAuthOptions.onSignIn` hook (admin `lib/auth.ts`), so the auth package keeps no direct
  database writes (service-layer sweep).
- Migration `0111_member_alerts`: `store_member.notification_prefs jsonb` + the SECURITY DEFINER
  function (REVOKE PUBLIC, GRANT app).
- Tests (run once, pass): core `member-account/alerts.test.ts` (owner by default + staff who
  asked, never a role without orders.read, WhatsApp to the mobile, store-wide switch off, daily
  summary at the hour and once a day), `packages/api/test/account-delete.test.ts` (own prefs only,
  owner blocked, email + code required, everything removed, another member's code refused),
  cross-store leak, notifications templates.
- Docs: merchant guide Your account (Notifications, Delete my account), Settings →
  Notifications FAQ.
