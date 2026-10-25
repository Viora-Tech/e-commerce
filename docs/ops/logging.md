# Structured logs

Server logs are structured with [evlog](https://evlog.dev) (MIT). Instead of scattered
`console.log` lines, each unit of work writes **one wide event**: a single JSON object with
everything known about it (what ran, for which store, how long it took, how it ended, the error).
Errors still go to GlitchTip as before ([error-tracking.md](error-tracking.md)); logs are the
searchable record of everything else.

The setup is one file, `packages/observability/src/log-options.ts` (`logOptions`): service name,
environment, sampling, PII scrubbing and the optional OTLP drain, the same for every app.

## Where events come from

| Event | Written by | Key fields |
| --- | --- | --- |
| oRPC procedure call (admin, over `/api/rpc` or a server page's `call()`) | `procedureLog`, `packages/api/src/procedures/logging.ts` | `procedure`, `storeId`, `userId`, `role`, `outcome` (`ok` / `rejected` / `error`), `status`, `errorCode` |
| BullMQ job attempt (worker) | `logWorkerJobs`, `packages/observability/src/log-worker-jobs.ts` | `job.queue`, `job.name`, `job.id`, `job.attempt`, `job.scheduled`, payload ids (`storeId`, `orderId`…), `outcome` (`completed` / `retrying` / `failed`), `result` (a sweep's counts) |
| Worker HTTP request (payment and courier webhooks) | `evlog/hono` middleware, `apps/worker/src/index.ts` | `method`, `path`, `status`, `storeId`, `webhook` (provider, event id, or the rejection reason) |
| Next.js route handler (storefront tracking links, OAuth callbacks, admin auth and uploads…) | `withEvlog` from `@/lib/request-log` | `method`, `path`, `status`, `storeId` (storefront, from `x-store-id`) |
| Render or route error nobody caught (admin, storefront) | `onRequestError` in each app's `instrumentation.ts` | `path`, `routePath`, `routeType`, `error` |
| A single line (a sweep's summary, a failure inside a loop) | `logger.info/warn/error`, `packages/observability/src/logger.ts` | `message` plus the fields passed in |

Every event also carries `timestamp`, `level`, `service` (`admin`, `storefront` or `worker`),
`environment`, `version` (when `SENTRY_RELEASE` is set) and `durationMs`.

A procedure call that was refused (`ORPCError` below 500):

```json
{
  "timestamp": "2026-10-13T10:23:45.612Z",
  "level": "warn",
  "service": "admin",
  "environment": "production",
  "version": "c211bc0c",
  "procedure": "orders.refund",
  "userId": "0193a2b4-1111-7e8f-9a0b-1c2d3e4f5a6b",
  "storeId": "0193a2b4-5c6d-7e8f-9a0b-1c2d3e4f5a6b",
  "role": "staff",
  "outcome": "rejected",
  "status": 403,
  "errorCode": "FORBIDDEN",
  "requestLogs": [{ "level": "warn", "message": "FORBIDDEN", "timestamp": "2026-10-13T10:23:45.610Z" }],
  "durationMs": 38,
  "duration": "38ms"
}
```

A job that will be retried:

```json
{
  "timestamp": "2026-10-13T10:24:02.004Z",
  "level": "warn",
  "service": "worker",
  "environment": "production",
  "job": { "queue": "notifications", "name": "send", "id": "412", "attempt": 1, "scheduled": false },
  "storeId": "0193a2b4-5c6d-7e8f-9a0b-1c2d3e4f5a6b",
  "orderId": "0193a2c0-9f1e-7a2b-8c3d-4e5f6a7b8c9d",
  "outcome": "retrying",
  "error": { "name": "Error", "message": "email: [redacted] rejected the message", "stack": "…" },
  "durationMs": 912,
  "duration": "912ms"
}
```

## Settings

All optional; with none set, logs print to the terminal (pretty in development, one JSON line
per event in production) and nothing else happens.

| Key | What it does |
| --- | --- |
| `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` | The full OTLP/HTTP logs URL. Set: events are also sent there in batches of 50 (or every 5 s), with retries. OpenObserve: `https://<host>/api/default/v1/logs`. |
| `OTEL_EXPORTER_OTLP_HEADERS` | Headers for that endpoint in the OpenTelemetry format: `key=value` pairs, comma-separated, values URL-encoded. OpenObserve: `Authorization=Basic%20<base64 of email:password>`; add `,stream-name=commerce` to write to a stream other than `default`. |
| `LOG_SAMPLE_RATE` | Percent (0–100) of ordinary events kept. Default 20 in production, 100 elsewhere. |

They are in `packages/config/src/env.ts`, `.env.example`, `deploy/env.production.example` and the
`x-app-env` block of `deploy/docker-compose.prod.yml`. The worker and both Next apps read the same
keys. The OTLP drain reads the two `OTEL_*` values itself, so set them in the process environment
(Dokploy's environment tab in production), not only in a file the app parses.

## Sampling

Head sampling keeps `LOG_SAMPLE_RATE` percent of ordinary events. These are always kept:

- every `warn`, `error` and `fatal` event;
- any event with `status` 400 or above (refused procedure calls, rejected webhooks, failed routes);
- anything that took 1 second or more (`SLOW_MS`);
- every job that is not a scheduler tick (an order email, an export, an image), and every
  `logger.*` line.

What gets sampled, then, is the steady stream of fast, successful work: procedure calls, page
beacons, OAuth hops, and the worker's every-minute scheduler ticks (`job.scheduled: true`) that
found nothing to do. A tick that did work also writes its own summary line (`outbox relayed`,
`unpaid orders expired`…), which is always kept.

## Privacy

Every event passes through `scrubLogEvent` (`packages/observability/src/scrub-log-event.ts`)
before it is printed or sent. It applies the same rules as error events (`scrubPii`):

- keys named like `email`, `phone`, `address`, `cookie`, `authorization`, `otp` or any credential
  (`token`, `secret`, `password`, `apiKey`…) are replaced by `[redacted]`, however deep;
- emails, UPI ids, phone numbers, JWTs and long opaque tokens inside any string are replaced too
  (this also covers tokens in paths such as `/api/m/open/<token>`).

Two exceptions keep events useful: record ids (UUIDs) are left as they are, wherever they appear,
and evlog's own fields (`timestamp`, `requestId`, `version`…) are not scanned.

Rules for code that logs:

- Pass ids (`storeId`, `orderId`, `userId`), counts and names as fields. Never an email, phone
  number, address, request body, token or a customer's name; the scrubber is a safety net, not
  the policy.
- Never log a request body or headers. The HTTP middlewares record method, path and status only.
- Inside a route handler wrapped in `withEvlog`, `useLogger().set({...})` adds fields to the
  request's event; in a procedure, `context.log.set({...})` does the same.
- Browser code never logs through this (`apps/admin/src/lib/client-errors.ts` and the client
  components keep their own handling).

A few `console.log` calls stay on purpose: development-only lines that hand a developer a
sign-in code or link (`apps/admin/src/lib/auth.ts`, the storefront's `*-actions.ts`,
`packages/api/src/routers/account.ts`, `packages/auth/src/merchant.ts`), the bug report printed
when no GitHub token is set, and the development `log` notification channels. They exist to be
read off the terminal unredacted and never run in production.

## Viewing logs in OpenObserve

[OpenObserve](https://github.com/openobserve/openobserve) takes OTLP logs directly and searches
them with SQL.

Locally:

```sh
docker run -d --name openobserve -p 5080:5080 \
  -e ZO_ROOT_USER_EMAIL=root@example.com -e ZO_ROOT_USER_PASSWORD=Complexpass#123 \
  -v openobserve-data:/data public.ecr.aws/zinclabs/openobserve:latest
```

Then in `.env`:

```sh
OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://localhost:5080/api/default/v1/logs
# base64 of root@example.com:Complexpass#123
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic%20cm9vdEBleGFtcGxlLmNvbTpDb21wbGV4cGFzcyMxMjM=
```

Restart the apps and the worker, use the admin for a minute, then open <http://localhost:5080>,
**Logs**, stream `default`. In production, point the same two keys at the self-hosted instance
(a dedicated ingestion user, not the root account).

Events are sent in the compact OTLP shape: nested fields become dotted attributes (`job.queue`),
which OpenObserve stores as flat columns (it may show them as `job_queue`). Useful queries:

```sql
-- everything that went wrong in one store today
SELECT * FROM "default" WHERE storeid = '<store uuid>' AND level IN ('warn', 'error')
-- slow procedures
SELECT procedure, durationms FROM "default" WHERE service = 'admin' AND durationms > 1000
-- failed jobs by queue
SELECT job_queue, count(*) FROM "default" WHERE outcome = 'failed' GROUP BY job_queue
```

Column names follow what OpenObserve shows in the field list; it lower-cases them.

Without an endpoint, the same events are in the container logs (`docker logs <container>` or
Dokploy's log tab), one JSON object per line, so `jq` works on them.
