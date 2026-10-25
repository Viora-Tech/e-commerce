# Staff invites are emailed, and pending invites are listed (2026-10-05)

On the test deploy an owner invited a teammate and nothing arrived: `createMerchantAuth`'s
`sendInvitationEmail` fell back to `console.log('[invite] …')` because the admin never passed
`sendInvite`, and the invite was not shown anywhere.

- **Email.** New platform template `staff_invite` in `@commerce/notifications` ("You're invited to
  manage <store> on Vextro", inviter, role, Accept invitation button; listed in
  `PLATFORM_TEMPLATE_IDS`, so it stays out of Settings → Notifications). Core
  `deliverPlatformStaffInvite` (`packages/core/src/accounts/staff-invite-email.ts`) sends it
  through `getPlatformEmail().transport` and answers `sent` / `refused` / `no_transport`. The admin
  `sendInvite` (`apps/admin/src/lib/auth.ts`) emails it with SES and never logs the URL, throws on
  refusal, and prints the console line only without a platform account (dev).
- **Refusal reaches the merchant.** Better Auth swallows errors thrown by `sendInvitationEmail`, so
  `runInvite` (`packages/auth/src/merchant.ts`, AsyncLocalStorage) carries the store name and role
  into the email and reports `emailError`; `staff.invite` returns `emailSent: false` and the invite
  dialog shows "Couldn't send the invite email".
- **Pending invites.** `staff.invitations` (staff.read), `staff.resendInvitation` and
  `staff.cancelInvitation` (staff.invite) in `packages/api/src/routers/staff.ts`, service
  `packages/api/src/services/staff-invites.service.ts`. Every action first checks the invitation
  belongs to the active store's organization (Better Auth alone would let a two-store owner touch
  the other store's invites). Resend on an open invite keeps the id and extends expiry; on an
  expired one Better Auth makes a new invitation, so the role moves over and the old one is
  cancelled. UI: `components/staff/pending-invites-card.tsx` (Copy invite link, Resend email,
  Cancel invite; expired rows greyed with Resend), copy `data/staff-invites.ts` + Hindi.
- Also added the missing SOURCE OF TRUTH header to `deliver-platform-code.test.ts` (#246), which
  failed `test:sweeps` on main.
- No migration.

Tests: `packages/notifications/test/templates.test.ts`,
`packages/core/src/accounts/staff-invite-email.test.ts`, `packages/api/test/invitations.test.ts`
("pending invitations": list, email failure, resend open/expired, cancel, cross-store, permission).
Docs: merchant guide `settings/staff.mdx` (new), developer `operations/running-locally.mdx`.
