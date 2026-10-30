# Security A5 (task 3/4): step-up guard + reauth router (flag off)

Third task of step-up re-authentication (A5). Wires the task-2 core into the admin: a guard that
refuses a stale session's sensitive action, and the `reauth.*` endpoints the dialog drives.
**Enforcement is off by default** (`STEP_UP_ENFORCE` unset), so this changes no runtime behavior
until task 4 flips it on.

## The guard — `packages/api/src/procedures/store.ts`
`requireStepUp` runs inside `storeProcedureWith`, on calls that run now (never on ones queued for
approval). When `context.stepUpEnforce` is on and the call is from a real browser session (not an
access token / MCP), a `kindForInput(path, input) === 'sensitive'` action is refused with a new
`STEP_UP_REQUIRED` ORPCError unless the session re-verified within the 10-minute window. Freshness
is read straight from the session row (`stepUpAgeMs`), not the cookie-cached `getSession`. Reads,
ordinary writes, a fresh session, access tokens/MCP, and enforcement-off all pass straight through.

## The router — `packages/api/src/routers/reauth.ts` (new)
People-only (`protectedProcedure`; excluded from the MCP catalogue), so it is always reachable to
clear a block:
- `status` → `{ method: 'passkey' | 'otp', fresh }` (passkey when one is enrolled).
- `sendOtp` → mints a step-up code and mails it (`deliverPlatformLoginCode`); rate-limited.
- `passkeyOptions` → WebAuthn options, rpID/origin pinned to `ADMIN_URL` (never the request).
- `verify({ otp | passkeyResponse })` → verifies and stamps the session; rate-limited.

## Wiring
- `context.ts`: `stepUpEnforce?` and `appUrl?` added.
- `apps/admin/src/lib/api.ts`: `apiHost()` sets `stepUpEnforce = STEP_UP_ENFORCE === 'true'`
  (default false) and `appUrl = ADMIN_URL`.
- `mcp/action-catalogue.ts`: `reauth` added to `EXCLUDED_NAMESPACES` (an MCP client must never
  step up a person's session).
- `_app.ts`: `reauth` router registered; `@commerce/auth` now re-exports the step-up core.

## Verification
- `packages/api/test/step-up-guard.test.ts` (new) drives the guard through `createRouterClient`
  (so the middleware sees the real dotted path): stale+sensitive+on → `STEP_UP_REQUIRED` and the
  row untouched; after `markReauthenticated` → runs; enforcement off → runs; reads and ordinary
  writes → run even stale. **4/4.**
- `packages/api/test/reauth.test.ts` (new): status offers otp→passkey; sendOtp mails a code,
  verify stamps the session fresh, replay fails, wrong code rejected; passkeyOptions returns
  rpID-bound options offering the member's credential. **4/4.**
- `mcp-action-catalogue` + `permissions` (the touched files) **13/13**, no regressions. Typecheck
  + biome clean.

## Next task
4. Admin re-auth dialog (full dialog, not a right-drawer) that catches `STEP_UP_REQUIRED`, runs
   `reauth.status` → passkey or OTP → `reauth.verify`, and retries the call; then flip
   `STEP_UP_ENFORCE` on (needs a cloud build). The step-up OTP email currently reuses the
   `login_code` template — task 4 can give it its own copy.
