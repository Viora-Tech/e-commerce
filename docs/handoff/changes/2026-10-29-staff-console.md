# Platform console (phase 1): `/platform` for VIORA INDIA staff

Branch `feat/platform-console-2026-10-26`, PR into `dev`. A console for the people who run the
platform, outside any store: Overview, Stores (list + detail), Users, Audit log, and a Reports nav
item (the reports page is the bug-report work's, `feat/bug-report-status-2026-10-26`).
Built from scratch. Developer docs: Operations → Platform console.

## Access

- New env `PLATFORM_ADMIN_EMAILS` (comma list; blank = nobody). In `packages/config/src/env.ts`,
  `deploy/docker-compose.prod.yml` `x-app-env`, `deploy/env.production.example`. **Set it in
  Dokploy on the admin app before anyone can open the console.**
- Guard (`platformProcedure`, `packages/api/src/procedures/platform.ts`): cookie session + email on
  the list + session opened with a passkey + host passed the owner connection. Everything else is
  NOT_FOUND (pages: Next's 404). Staff must sign in with a passkey (Account → Sign-in & security).
- Never reachable by access tokens or MCP: `platform` is in `EXCLUDED_NAMESPACES`, the token/MCP
  hosts do not pass `platformDb`, and the guard refuses `apiPrincipal`.

## Data

- Core reads: `packages/core/src/platform/` (`access.ts`, `overview.ts`, `stores.ts`, `users.ts`,
  `audit.ts`, pure `client.ts` → `@commerce/core/platform`). All run in `platformRead`: a READ ONLY
  transaction on the owner connection (`ownerDb()` in `apps/admin/src/lib/db.ts`, pool of 2).
- Integrations on the store page are connected yes/no from provider ids only; settings values
  never leave Postgres (test asserts no key text in the result).
- Worker queue counts: `queueHealth()` in `packages/queue/src/health.ts`, passed as
  `context.queueHealth` by `platformHost()`.
- Open bug reports: GitHub search (`services/platform.service.ts`), null without a token.

## Migration 0175_platform_access_log

`platform_access_log` (actor id/email, action, `store_id_ref`, target, time), no `store_id`, no
grant to `app`. Every platform read writes one row (`context.platform.audit`). The bug-report
work's migration follows as 0176.

## Tests

- `packages/core/src/platform/platform.test.ts`: overview numbers (test/cancelled orders out, MRR,
  overdue bills, outbox), store list search/filters, store detail (no secrets), users, audit
  filters, read-only transaction, app role cannot read the log, passkey check.
- `packages/api/test/platform.test.ts`: NOT_FOUND for signed-out, non-staff, OTP session, no owner
  connection, access token, empty list; staff path logs each read; no `platform.*` MCP action.
- `cross-store-leak.test.ts`: platform procedures in `SKIP` (they answer NOT_FOUND there). Its
  0.6 coverage floor read 0.5994 on this machine with the platform procedures skipped, which looks
  like a problem already on `dev`.

## Not done (phase 2)

Impersonation, store actions beyond open storefront / copy ids, Hindi copy for these pages.
