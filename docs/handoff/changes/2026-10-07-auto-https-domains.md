# Automatic HTTPS routes for custom domains (2026-10-07)

Branch `feat/auto-https-domains`, issue #267. Migration `0092_domain_routes`.

A custom domain could not reach SSL `active` on the server: Traefik only routes and certifies
hostnames added to a Dokploy application, and someone added each one by hand. Now the worker
does it through the Dokploy REST API (`packages/core/src/domains/routes.ts`, client in
`dokploy.ts`):

- **Ask**: `pollPendingDomains(..., { requestRoutes })` (worker, `{domains}-verify`): a live
  custom domain without a working certificate and no recent request (`needsRouteRequest`,
  retry window `ROUTE_RETRY_MS` = 30 min) gets `route_status = 'pending'`,
  `route_requested_at = now` and a `domain.route_requested` outbox row, one transaction.
- **Do**: the relay queues a `{domains}-route` job (`jobId route-add-<outbox id>`, 6 attempts,
  exponential from 30 s). `runDomainRouteJob` re-reads the row (custom, `active`), re-checks the
  hostname (`isRoutableHostname`: `normaliseHostname` round-trip, not under `platformRoots(env)`,
  not `STOREFRONT_CNAME_TARGET`), lists `domain.byApplicationId`, creates only if missing
  (`domain.create`: https, letsencrypt, path `/`, `DOKPLOY_STOREFRONT_PORT`, `stripPath false`),
  then `route_status = 'ready'`. A job out of retries marks the row `failed`
  (`markDomainRouteFailed`, only from `pending`); the poll asks again after the window.
- **Remove**: `removeDomain` writes `domain.route_removed { hostname }` when `route_status` is not
  `none`; the job deletes every matching Dokploy domain unless `resolve_store(hostname)` says the
  hostname is live again somewhere.
- www twins are their own rows, so they get their own route.
- Admin requests never call Dokploy. Requests: `x-api-key` header only, 10 s timeout
  (`AbortSignal.timeout`), `redirect: 'error'`; errors carry the HTTP status, never the key or the
  response body.
- Env (worker only, compose `worker.environment`, not `x-app-env`): `DOKPLOY_URL`,
  `DOKPLOY_API_KEY`, `DOKPLOY_STOREFRONT_APPLICATION_ID`, `DOKPLOY_STOREFRONT_PORT` (default
  3100). Any of the first three unset: no requests, jobs are no-ops, today's behaviour.
- Admin: the SSL line for an `issuing` domain reads "Getting your security certificate…", or the
  "taking longer than usual" line when `route_status = 'failed'`. Copy in
  `domainCertificateContent` (`apps/admin/src/data/domains.ts`), Hindi in `data/hi/domains.ts`.
  The old `domainsContent.detail.ssl.issuing` key is gone.

Dokploy API checked against Dokploy's source (`apps/dokploy/server/api/routers/domain.ts`,
`packages/server/src/services/domain.ts`): `createDomain` calls `manageDomain` for applications,
so no redeploy is needed; `delete` calls `removeDomain`.

Tests: `dokploy.test.ts` (fake fetch: shapes, header, timeout, errors), `routes.test.ts` (fake
client + test DB: create, already exists, delete, Dokploy down then retry, failed then re-ask,
env unset, platform host refused, www twin), `env.test.ts`. Sweeps: `deploy-compose`
(`NOT_FOR_APPS` lists the four worker-only keys), `no-orphans` (test-only exports allow-listed).

Owner setup (not done, code only): Dokploy → Settings → Profile → API/CLI → generate key; storefront
app id from its URL; set the four keys on the worker app; redeploy the worker. Docs: developer
docs, Custom domains, "Each live hostname also needs an HTTPS route on the proxy".

Not done / follow-ups:
- Routes added by hand before this are never deleted by the worker (it only removes routes it
  asked for).
- If a hostname is on another Dokploy app too, Dokploy is not asked; Traefik would see two
  routers. Keep merchant domains on the storefront app only.
- `PLATFORM_DOMAINS` in `deploy/env.production.example` still lists `waimers.in`; a hostname in
  that list cannot be connected as a store domain.
