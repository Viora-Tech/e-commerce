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

## Browser errors

The admin and storefront also report errors thrown in the browser, to the same GlitchTip project
as their server side, and only when `SENTRY_DSN` is set.

- **Runtime DSN.** The image is built once and env is set at deploy, so the DSN is not baked in
  with `NEXT_PUBLIC_*`. The root layout (admin `app/layout.tsx`, storefront
  `app/-s/[storeId]/layout.tsx`) renders `<meta name="sentry-browser">` with the DSN,
  environment and release only (`browserSentryMeta`); `instrumentation-client.ts` reads it and
  starts the SDK. No tag, no SDK. A DSN is public by design. A meta tag runs no script, so the
  nonce CSP is untouched; the CSP has no `connect-src`, so reports to the GlitchTip host are
  allowed (if one is ever added, it must list the DSN's origin).
- **Errors only.** `browserSentryOptions` (`packages/observability/src/browser-sentry-options.ts`):
  no tracing (`tracesSampleRate: 0`), replay, sessions, client reports or default PII.
  `beforeSend` drops noise (browser extensions, `ResizeObserver loop`, aborted or failed fetches
  such as Safari's `Load failed`, `Script error.`, errors thrown by scripts on another origin),
  sends each bug once per page load (30 events at most), removes query strings and hashes from
  every URL, then runs `scrubPii`.
- **Small.** Each app builds a bare `BrowserClient` with only the integrations an error needs
  (`src/lib/browser-errors.ts`) instead of `Sentry.init`. The storefront loads that chunk after
  the page has loaded and gone idle (about 25 KB gzipped, only when a DSN is set); errors thrown
  before then are held (`queueEarlyBrowserErrors`) and sent once it starts. The admin loads it
  up front, with breadcrumbs, and also reports what its route error boundary catches (errors
  with a server digest are skipped: the server already reported them).
- **"Report a bug"** in the admin keeps its own in-tab buffer (`lib/client-errors.ts`),
  independent of GlitchTip.

To try it: set `SENTRY_DSN`, restart the app, open a page, run
`setTimeout(() => { throw new Error('browser test') })` in the devtools console (a plain
`throw` typed in the console is not reported by browsers), and the event appears in the app's
GlitchTip project with the page URL's query string removed.

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
