# Structured logs with evlog

Server code logs **wide events** (one JSON object per procedure call, job attempt and HTTP
request) through [evlog](https://evlog.dev) instead of `console.*`. Full guide:
`docs/ops/logging.md`.

- **Config, one place:** `packages/observability/src/log-options.ts` (`logOptions`): service,
  environment, sampling (20% of ordinary events in production; every warning, error, status ≥ 400
  and anything ≥ 1 s kept), PII scrub (`scrub-log-event.ts`, reuses `scrubPii`, keeps UUIDs), and
  an optional batched OTLP/HTTP drain. Entry `@commerce/observability/logging`; the Next.js
  helpers are `@commerce/observability/logging/next` (Node runtime only).
- **New env keys (all optional):** `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`,
  `LOG_SAMPLE_RATE`. Unset: logs only go to stdout (pretty in dev, JSON in production).
- **Worker:** `initLogging` at boot, `logWorkerJobs` next to `reportWorkerFailures` for every
  queue, `evlog/hono` middleware on the webhook routes, `flushLogs` on shutdown.
- **API:** `procedureLog` middleware on `base` (`packages/api/src/procedures/logging.ts`); the
  auth middlewares add `userId`, `storeId` and `role`. API tests turn the logger off
  (`test/support/quiet-logs.ts`).
- **Admin/storefront:** `instrumentation.ts` starts the logger (`nextLogInstrumentation`) and logs
  uncaught render errors; non-static route handlers are wrapped in `withEvlog` from
  `@/lib/request-log`. Nothing runs in the browser; `proxy.ts` is unchanged.
- **`console.*` replaced** by `logger.info/warn/error(message, fields)` across `apps/*/src` and
  `packages/*/src`. Left on purpose: browser code, scripts and seeds, and the dev-only lines that
  print a sign-in code or link (listed in the guide).

Tests written (`packages/observability/test/log-options.test.ts`, `scrub-log-event.test.ts`, and
`packages/core/src/workflow/run.test.ts` updated), not run here.
