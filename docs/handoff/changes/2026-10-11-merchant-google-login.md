# Merchant "Continue with Google" on the admin login page

- Branch `feat/merchant-google-login`. No migration: Better Auth's `account` table already
  exists; `member_sign_in.method` is text and now also gets `google`.
- Env: `MERCHANT_GOOGLE_CLIENT_ID` / `MERCHANT_GOOGLE_CLIENT_SECRET` (`packages/config/src/env.ts`,
  `merchantGoogleSignIn`). Both set turns it on; either blank leaves the provider out of Better
  Auth and hides the button. Redirect URI `<ADMIN_URL>/api/auth/callback/google`. Added to
  `deploy/docker-compose.prod.yml` x-app-env, `deploy/env.production.example`, `.env.example`.
- Auth: `packages/auth/src/merchant.ts` (Google provider with `prompt: select_account`, One Tap
  off, `validateMerchantUserInfo` requires Google's `email_verified === true`, implicit linking
  only on verified matching email, tokens encrypted, Google photo dropped, origin check forced on).
  The sign-in log path is filled from the route params (`/callback/:id` → `/callback/google`).
- Admin route: `/sign-in/social` rate limited per IP (20 per 10 min); `auth-paths.ts` now also
  blocks `/link-social`, `/unlink-account`, `/list-accounts`, `/get-access-token`,
  `/refresh-token`, `/account-info`.
- UI: `components/auth/google-sign-in.tsx` above the email form (both sign-in and sign-up);
  `/login?error=<code>` shows a known-code message (Better Auth's `errorCallbackURL`).
  Account → Sign-in & security shows a read-only Google card (`google-link-card.tsx`) when Google
  is offered or linked; `account.security` returns `google: { available, linkedAt }`. No unlink.
- New users go to `/` → `/onboarding` → signup gate, exactly like an email-code user.
- Tests: `packages/auth/test/merchant-google.test.ts` (full redirect flow with Google's token
  endpoint faked), `packages/api/test/account-security.test.ts`, `auth-paths.test.ts`,
  `sign-ins.test.ts`, `env.test.ts`.
- Docs: merchant guide Your account ("Sign in with Google"), Getting started; developer docs
  Running locally, Security.
