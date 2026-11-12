# Automation HTTP limit per store; three env settings validated (12 Nov 2026)

## Automations "Send HTTP request": per-store caps that actually hold

- The per-store rate cap (10 requests a second) was never switched on: the worker never passed a
  rate-limit store. It now passes one on the BullMQ Redis (`apps/worker/src/automations.ts`).
- The in-flight cap (5 calls at once per store) was a counter in process memory, so every worker
  copy allowed 5. It is now an expiring lease in the same Redis
  (`packages/core/src/rate-limit/concurrency.ts`, `createRedisConcurrencyStore`): one atomic Lua
  script drops expired leases, counts the rest and takes a slot only when there is room.
- The slot is given back in `finally` (success, error answer, timeout, dropped connection), and
  is held until the answer has been read. Every lease expires after 60 s (the 30 s request timeout
  plus room), so a worker that crashes mid-call cannot hold a slot for ever. A failed release is
  ignored (the lease runs out); a Redis error while taking a slot is a retryable step failure.
- Without a shared store (tests, local runs) an in-process store with the same rules is used.
- Tests: `concurrency.test.ts` (both stores) and new cases in `actions/http.test.ts` (two worker
  copies sharing one store, release on error and timeout, lease length, Redis down).

## Env settings now read through `@commerce/config`

- `STEP_UP_ENFORCE`: a schema flag (`true`/`false`, also `1`/`0`, `yes`/`no`; default off).
  `apps/admin/src/lib/api.ts` reads `loadEnv(...).STEP_UP_ENFORCE`. Any other value now stops the
  app at start instead of quietly meaning "off". Added to compose `x-app-env` and
  `deploy/env.production.example`.
- `SETTINGS_SECRET_PREVIOUS`: the schema now gives a trimmed list (`string[]`) and refuses an
  entry under 16 characters (every retired key was once a SETTINGS_SECRET). The storefront
  shopper login and the customer-accounts router used to split without trimming, so a space
  after a comma broke decryption there. `decryptSecret` in core reads the list through
  `previousSettingsSecrets()` (no database URLs needed), not `process.env`.
- `NEXT_PUBLIC_WORKER_URL` on the server: `workerPublicUrl(env)` (`packages/config/src/env-runtime.ts`)
  replaces `process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:…'` in the payments router and
  the app-connect service. Production with no value throws (the admin checks it at boot in
  `instrumentation.ts`, skipped during `next build`); development keeps the localhost default.
  The build-time value (the admin image's `--build-arg`) still wins: the helper's default argument
  is the literal `process.env.NEXT_PUBLIC_WORKER_URL`, which Next inlines.

## Left alone

- The admin's client components (`courier-*`, `connect-*`, `advanced-payments.tsx`) still read
  `process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:4100'`. They run in the browser, where
  the value is inlined at build time and the env schema cannot be loaded.
