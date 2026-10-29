# Staff console (platform console, phase 1): `/platform` for VIORA INDIA staff

Branch `feat/staff-console`, PR into `dev`. Finishes the 27 Oct work on
`feat/platform-console-2026-10-26` (both commits cherry-picked onto `dev`). A read-only console
for the people who run the platform, outside any store: Overview, Stores (list + detail), Users
and Audit log. Built from scratch. Developer docs: Operations → Platform console.

## Access

- New env `PLATFORM_ADMIN_EMAILS` (comma list; blank = nobody). In `packages/config/src/env.ts`,
  `deploy/docker-compose.prod.yml` `x-app-env`, `deploy/env.production.example`. **Set it in
  Dokploy on the admin app before anyone can open the console.** The admin also needs
  `DATABASE_URL_OWNER` (the superuser) at runtime for `ownerDb()`.
- Guard (`platformProcedure`, `packages/api/src/procedures/platform.ts`): cookie session + email on
  the list + session opened with a passkey + host passed the owner connection. Everything else is
  NOT_FOUND (pages: Next's 404). Staff must sign in with a passkey (Account → Sign-in & security).
- Pages: the `(platform)` layout and every page call `requirePlatformStaff()`
  (`apps/admin/src/lib/platform-access.ts`), which asks `platform.whoami`, the same guard.
- Never reachable by access tokens or MCP: `platform` is in `EXCLUDED_NAMESPACES`, the token/MCP
  hosts do not pass `platformDb`, and the guard refuses `apiPrincipal`.

## Data

- Core reads: `packages/core/src/platform/` (`access.ts`, `overview.ts`, `stores.ts`, `users.ts`,
  `audit.ts`, pure `client.ts` → `@commerce/core/platform`). All run in `platformRead`: a READ ONLY
  transaction on the owner connection (`ownerDb()` in `apps/admin/src/lib/db.ts`, pool of 2).
  No procedure writes to any store's data.
- Integrations on the store page are connected yes/no from provider ids only; settings values
  never leave Postgres (test asserts no key text in the result).
- Worker queue counts: `queueHealth()` in `packages/queue/src/health.ts`, passed as
  `context.queueHealth` by `platformHost()`.
- Open bug reports on the Overview: a count from GitHub search (`services/platform.service.ts`),
  null without a token. There is no reports page (see "Left out").

## Migration 0186_platform_access_log

`platform_access_log` (actor id/email, action, `store_id_ref`, target, time), no `store_id`, no
grant to `app`. Every data read writes one row (`context.platform.audit`) after the read and
before returning; `platform.whoami` (the page guard, returns only the caller) is not logged.
Generated with drizzle-kit on `dev` at 0184 (`0186_snapshot.prevId` = 0184's id). 0185 is open
PR #948's: whichever merges second re-chains its snapshot (`_journal.json` conflict + regenerate).

## Copy

`data/platform.ts`, Hindi in `data/hi/platform.ts`; server pages and components read it with
`getCopy`, the frame with `useCopy`.

## Tests

- `packages/core/src/platform/platform.test.ts`: overview numbers (test/cancelled orders out, MRR
  from `PLANS`, overdue bills, outbox), store list search/filters, store detail (no secrets), users,
  audit filters, read-only transaction, app role cannot read the log, passkey check.
- `packages/api/test/platform.test.ts`: NOT_FOUND for signed-out, non-staff, OTP session, no owner
  connection, access token, empty list; staff path logs each read; no `platform.*` MCP action.
- `cross-store-leak.test.ts`: platform procedures in `SKIP` (they answer NOT_FOUND there). No
  findings. Its 0.6 coverage floor fails on plain `dev` too (0.591 on 29 Oct; 0.593 here).

## Left out

- **Bug report status** (`feat/bug-report-status-2026-10-26`, local only, plus
  `_worktree-backups/2026-10-29/agent-acf63f1ce52a15529.*`): GitHub issue sync (webhook route,
  worker job, new `bug_report` table and its own migration), status notifications by email and
  WhatsApp, Account → Bug reports page, unread badge, and a `/platform/reports` respond dialog.
  Around 2,000+ lines across worker, notifications, db and admin; too large for this PR. Its
  Reports nav item and the empty `platform.reports` router are removed here; a later PR adds them
  back with the real page.
- Phase 2: impersonation, store actions beyond open storefront / copy ids.
