# Step-up re-auth: admin dialog (A5 task 4/4)

Finishes A5 (step-up re-authentication). Tasks 1–3 shipped the column + migration (`0192`), the
verification core in `@commerce/auth`, and the server guard + `reauth` router (merged to dev as
#1002/#1003/#1004). This task adds the admin UI that catches the guard's refusal and re-verifies.

## What it does

When any orpc call is refused with the ORPC code `STEP_UP_REQUIRED` (thrown by `requireStepUp` in
`packages/api/src/procedures/store.ts` for a sensitive action on a stale session), the admin now:

1. Opens a **centered Dialog** (`StepUpProvider`) — not a right-side drawer.
2. Calls `reauth.status`. If a passkey is enrolled (and the browser supports WebAuthn) it offers the
   passkey, with a "use a code by email instead" link; otherwise it sends a 6-digit code to the
   member and shows the code entry straight away. If the session turned fresh meanwhile, it closes
   and continues with no prompt.
3. Passkey: `reauth.passkeyOptions` → `@simplewebauthn/browser` `startAuthentication` →
   `reauth.verify({ passkeyResponse })`. Code: `reauth.sendOtp` → `reauth.verify({ otp })`.
4. On success it **retries the originally blocked call once** and resolves it, so the member's
   action completes. On cancel it rejects with the original error (the calling page shows it).

## Retry mechanism

The api-client interceptor is not React, so a module-level gate (`lib/step-up-gate.ts`) bridges it to
the dialog: the mounted `StepUpProvider` registers an opener; on a `STEP_UP_REQUIRED` catch the
interceptor awaits `requestStepUp()` (which opens the dialog and resolves true/false), then re-runs
`next()` once. Several sensitive calls refused at once share one dialog (one `pending` promise). When
no dialog is mounted the gate resolves false and the original error propagates unchanged.

## Files

- `apps/admin/src/lib/step-up-gate.ts` (new) — `isStepUpRequired`, `setStepUpOpener`, `requestStepUp`.
- `apps/admin/src/components/auth/step-up-dialog.tsx` (new) — `StepUpProvider` dialog.
- `apps/admin/src/data/step-up.ts` + `apps/admin/src/data/hi/step-up.ts` (new) + registered in
  `apps/admin/src/data/hi/index.ts` — English copy and its Hindi overlay.
- `apps/admin/src/lib/api-client.ts` — interceptor catches `STEP_UP_REQUIRED` and retries once.
- `apps/admin/src/app/layout.tsx` — mounts `StepUpProvider` around the app.
- `apps/admin/package.json` — `@simplewebauthn/browser@13.3.0` promoted to a direct dep (already in
  the lockfile via `@better-auth/passkey`; matches the server's `@simplewebauthn/server@13.3.3`).

## Still off; needs a cloud build to turn on

Enforcement remains **off**: `STEP_UP_ENFORCE` (read in `apps/admin/src/lib/api.ts` `apiHost`) is
unset, so the guard never throws and this dialog never opens in production yet. Flipping it on is a
runtime change that needs a cloud build (the local admin build thrashes this box) and the owner's
go-ahead. The step-up OTP email still reuses the platform `login_code` template; it can get its own
copy later.

**Prod:** migration `0192_session_reauth.sql` must be applied to prod at the next release.
