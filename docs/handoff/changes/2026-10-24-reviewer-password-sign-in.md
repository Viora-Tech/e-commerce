# Reviewer password sign-in

Shopify's app review refuses test accounts that sign in with an email code or SSO. One member
named by `REVIEWER_LOGIN_EMAIL` can now also sign in with `REVIEWER_LOGIN_PASSWORD` ("Sign in with
a password" on the login page, shown only when both are set).

- `packages/auth/src/reviewer.ts`: Better Auth plugin, `/sign-in/reviewer-password`. It only signs
  in an existing member; it never creates one. It is rate limited and stores no password.
- `reviewerSignIn` in `@commerce/config`; wired in `apps/admin/src/lib/auth.ts` and on the login
  page.
- Tests: `packages/auth/test/merchant-reviewer.test.ts`.
- Setup: invite the reviewer email to the review store (Claw Gears) and accept it once with the
  email code. Then set both env keys on the admin in Dokploy.
