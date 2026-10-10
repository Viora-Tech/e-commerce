# Account: Sign-in & security, Sessions, passkeys

Branch `feat/account-security` (part 2 of 3 of the member Account area; stacked on
`feat/account-page`).

- **Sign-in & security** (`/account/security`, `components/account/security-page.tsx`):
  - **Change email** (`change-email-dialog.tsx`): `account.requestEmailChange` →
    Better Auth's email-OTP `requestEmailChangeEmailOTP` (enabled in
    `packages/auth/src/merchant.ts`, `changeEmail: { enabled: true }`) sends a code to the NEW
    address through the platform account (`email_change_code` template; admin `lib/auth.ts`
    picks it for OTP type `change-email`). `account.confirmEmailChange` →
    `changeEmailEmailOTP`, then `deliverPlatformEmailChanged` tells the OLD address
    (`email_changed` template, new address masked). Rate limits: 5 codes/hour, 10 confirm
    tries/hour per member, on top of Better Auth's 3 tries per code. A new address that already
    has an account gets no code (Better Auth answers the same), so nothing leaks.
  - **Passkeys** (`passkeys-card.tsx`, `passkey-name-dialog.tsx`): Better Auth passkey plugin
    `@better-auth/passkey` 1.7.6 (MIT, credited in THIRD_PARTY_NOTICES). rpID = the admin URL's
    host, origin pinned to `ADMIN_URL` (never read from the request). Add (named first, defaults
    to "Chrome on Windows"), rename, remove (confirm). Login page: `PasskeySignIn`
    (`components/auth/passkey-sign-in.tsx`) under the email form, hidden where WebAuthn is
    missing.
  - **Recent sign-ins**: new platform table `member_sign_in` written by a Better Auth
    `databaseHooks.session.create.after` (`packages/auth/src/sign-in-log.ts`): method (code or
    passkey), user agent, masked IP (IPv4 /24, IPv6 /48) and city/country from Cloudflare's
    `cf-ipcity`/`cf-ipcountry` only when `TRUSTED_PROXY=cloudflare`. Kept 90 days. With IP
    tracking off (default) the place shows "Place unknown".
- **Sessions** (`/account/sessions`, `components/account/sessions-page.tsx`):
  `account.sessions` wraps Better Auth `listSessions` and returns no tokens; `revokeSession`
  takes a session id, looks the token up for the caller's own sessions only, and refuses this
  browser's session; `revokeOtherSessions`. Confirm dialogs (`confirm-dialog.tsx`, also used
  for Leave store now). Note shown: a signed-out device's open page can keep working for up to
  5 minutes (Better Auth's cookie cache, `session.cookieCache.maxAge`).
- Admin auth route now refuses over HTTP (GET and POST, `lib/auth-paths.ts`):
  `/email-otp/request-email-change` and `/email-otp/change-email` (would skip our rate limits and
  the old-address notice), `/update-user` (profile goes through `account.updateProfile`) and
  `/list-sessions` (handed every session token, httpOnly or not, to page scripts). The server
  still calls them through `auth.api`.
- `protectedProcedure` now carries `session.sessionId` (marks "This device").
- `ApiContext.platformEmail` (optional) lets tests pass a fake platform account.
- Migration `0110_account_security`: `passkey` and `member_sign_in` (platform tables, no
  store_id, `GRANT … TO app` like 0008).
- Device names: `describeUserAgent` in `@commerce/core/member-account` (client-safe entry is
  now `member-account/client.ts`).
- Tests (run once, pass): `packages/api/test/account-security.test.ts` (sessions scoped to the
  member, no tokens, cannot revoke someone else's or this session, revoke others keeps this
  one; sign-ins recorded per member; change email code → new address, wrong code refused, old
  address notified; taken email gets no code; rate limit), core `devices`/`email-change`, auth
  `sign-in-log`, notifications templates.
- Docs: merchant guide Settings → Your account (sign-in, passkeys, sessions sections).
