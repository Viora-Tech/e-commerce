# Error tracking

Errors are captured with the Sentry SDKs — `@sentry/nextjs` in the admin and storefront apps,
`@sentry/bun` in the worker — pointed at a [GlitchTip](https://glitchtip.com) DSN instead of
Sentry's own SaaS. GlitchTip is MIT-licensed and speaks the same event protocol the Sentry SDKs
use, so nothing SaaS-specific (source-map upload, Sentry's own release/CI integration) is wired
up; only the DSN and `beforeSend` scrubbing matter here.

Structured logs (one wide event per request, procedure call and job, shipped to OpenObserve)
are separate: see [logging.md](logging.md).

## It is off by default

Nothing is captured anywhere until `SENTRY_DSN` is set. Each app's `Sentry.init` (or, in the
worker, `initSentry`) is skipped entirely when the env var is absent — see
`apps/admin/src/instrumentation.ts`, `apps/storefront/src/instrumentation.ts` and
`apps/worker/src/observability.ts`. Local development has nothing configured by default, so it
stays off unless you opt in.

## Running GlitchTip locally

GlitchTip is **not** part of `bun run infra:up`. Start it explicitly, on its own profile:

```sh
docker compose --profile observability up -d
```

This brings up `glitchtip-web`, `glitchtip-worker`, `glitchtip-migrate` and their own Postgres
and Redis (never the app's `commerce` database or main Redis/Dragonfly instance). Once it's
healthy:

1. Open <http://localhost:8000>, register the first account (open registration is on for local
   use only — `ENABLE_OPEN_USER_REGISTRATION=true` in `docker-compose.yml`), and create an
   organization and a project per app (`admin`, `storefront`, `worker`).
2. Copy each project's DSN from **Settings → Client Keys (DSN)**.
3. Put it in `.env` as `SENTRY_DSN` (one DSN per app if you want them separated — run the
   command from the relevant app's directory, or override the env var per-process; a single
   shared DSN across all three is also fine for local testing).
4. Optionally set `SENTRY_ENVIRONMENT` (defaults to `NODE_ENV`) and `SENTRY_RELEASE` (e.g. a git
   SHA; left unset in development).
5. Restart the app. Trigger an error and check the GlitchTip project — it should appear within a
   few seconds.

Bring it down with `docker compose --profile observability down` (add `-v` to drop its volumes).

## What gets tagged

- **Admin**: unexpected oRPC procedure errors are tagged with `storeId` — see
  `packages/api/src/procedures/store.ts`'s `storeProcedureWith`, wired to Sentry via
  `apps/admin/src/lib/sentry-report.ts`. Deliberate `ORPCError`s (unauthorized, forbidden,
  validation, not found) are **not** reported — they're expected client-facing responses, not
  bugs.
- **Worker**: every BullMQ job failure is captured via
  `@commerce/observability`'s `reportWorkerFailures`, tagged with the queue name, job name and
  `storeId` when the job payload carries one (see `apps/worker/src/index.ts`). The job payload
  itself is never sent, only those tags.
- **Environment/release**: every event carries `environment` (`SENTRY_ENVIRONMENT`, or
  `NODE_ENV`) and `release` (`SENTRY_RELEASE`) when set.

## PII scrubbing

Every event passes through `scrubPii` (`packages/observability/src/scrub-pii.ts`) in
`beforeSend`/`beforeSendTransaction` before it's sent anywhere:

- Known-sensitive object keys (`email`, `phone`, `address`, `ip_address`, `token`,
  `authorization`, `cookie`, …) are redacted outright, regardless of shape.
- Every remaining string is scanned for email addresses, phone numbers and token/JWT-shaped
  substrings and those are redacted too, so PII embedded in a free-text error message (e.g.
  `"payment failed for asha@example.com"`) doesn't leak either.

`packages/observability/test/scrub-pii.test.ts` covers both passes. Run it directly with
`bun run test --cwd packages/observability` — no Sentry SDK, DSN or Docker needed, since the
scrubber has no runtime dependency on any of them.

## Why not Sentry SaaS

Already decided in `docs/open-source-radar.md`: GlitchTip is MIT-licensed and Sentry-protocol
compatible, so the official Sentry SDKs work against it unmodified — only the DSN changes. No
code from GlitchTip itself is copied into this repo (it runs as a separate Docker service), so
no `THIRD_PARTY_NOTICES.md` entry is needed.
