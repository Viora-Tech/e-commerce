---
name: koomerce-testing
description: Decide which Koomerce checks to run and how to run them on the owner's low-memory Windows machine - vitest per package or file, typecheck, lint, guardrail sweeps, the test database, stale node_modules in worktrees, and what never to run (full builds, several dev servers, bun install without asking). Use before running any test, typecheck, lint, build or dev server in this repo.
metadata:
  checked-against: "dev, 20 Nov 2026"
---

# Testing in Koomerce

Guides: `apps/docs/content/developer-docs/operations/testing.mdx` and `docs/guardrails.md`
("Running the sweeps", "Testing fast").

## Machine rules (always)

- **No full builds** (`bun run build`, `next build`, Docker image builds) unless the owner asks.
  `typecheck` covers types; a build is only needed for build config or bundler-only problems.
- **One dev server at a time.** The owner's localhost copy runs admin on 3200 and storefront on
  3100. Background agents use ports 3700+ and stop them afterwards.
- **Do not run `bun install`** without the owner's OK. Worktrees have their own `node_modules`,
  often older than `package.json` on `dev`.
- Keep `TEST_WORKERS` at 3 or below (each worker is a Node process with database pools).
- GitHub Actions CI is off (billing), so checks run locally.

## When to run what (owner's workflow)

- **On a feature branch**: the owner checks the change on localhost; tests, lint and sweeps are
  not required on the branch. Say in the handoff note which tests you wrote but did not run.
- **On `dev`** (after merge, or for a fix committed straight to `dev`): typecheck and run the
  touched tests before pushing; the full suites run on `dev` before a release.
- **Release**: `bun run audit`, `bun run typecheck`, `bun run test`, then the smoke checklist
  (`apps/docs/content/developer-docs/operations/release-checklist.mdx`).

## Commands, cheapest first

```sh
bun run code-map <area>                  # find the files (no build, no deps beyond bun)
bun run lint:components                  # React file-structure checker
bun run check:changed --no-test          # biome + tsc on what changed since origin/dev
bun run check:changed                    # ... plus vitest "related" tests
cd packages/core && bunx vitest run src/order/place-order.test.ts   # one file
bun run turbo:shared run typecheck test --filter=@commerce/core     # one package, cached
bun run affected                         # packages changed since origin/dev + dependents
bun run test:sweeps -- scripts/sweeps/<name>.test.ts                # one sweep
bun run test:sweeps                      # all sweeps
bun run test                             # everything (turbo cache skips unchanged)
```

`test` and `typecheck` are turbo-cached and the cache is shared by every worktree
(`scripts/turbo.ts`). A change to `commerce.config.ts`, `commerce.blocks.config.ts` or a plugin
package is only fully covered by `bun run test`.

## Which tests per area

| Area | Run |
| --- | --- |
| Delivery options | `packages/core/src/shipping/delivery-options/*.test.ts`, admin `src/components/apps/delivery-options`, storefront `delivery-method.test.ts`, `checkout-preview.test.ts` |
| Checkout, orders, store credit | `packages/core/src/order/*.test.ts`, `src/customers/store-credit-checkout.test.ts`, `src/payments` |
| Liquid themes | `packages/core/src/theme-import/engine.test.ts`, `import.test.ts`, storefront `src/lib/liquid-*.test.ts` |
| Theme editor | `apps/admin/src/components/themes/customize/*.test.tsx` (jsdom) |
| Emails | `packages/notifications/test/*.test.ts` |
| MCP and AI agents | `packages/api/test/mcp.test.ts`, `mcp-actions.test.ts`, `mcp-action-catalogue.test.ts`, storefront `src/lib/agent-mcp.test.ts` |
| App blocks | `packages/blocks/test/app-blocks.test.ts`, `render.test.tsx` |
| Admin copy (Hindi) | `bun run --cwd apps/admin test` (the i18n test) plus typecheck |

## Test database

- Database-backed packages (`api`, `auth`, `core`, `db`, `plugin-back-in-stock`,
  `plugin-gst-invoices`, `plugin-shopify-import`) need Postgres: `docker compose up -d --wait`.
  Their global setup migrates a template and clones one copy per worker. In `packages/core` this
  applies to every test file, pure ones included.
- Tests refuse any database not named `commerce_test...` (`assertTestDatabase`).
- Parallel worktrees: set `TEST_DB_NAMESPACE=<short_name>` so runs do not reset each other.

## Reading failures

- **`Cannot find module` / missing export from a package you did not touch**: usually the
  worktree's `node_modules` is older than `dev`'s `package.json` (a dependency was added since).
  Report it and ask before installing; do not "fix" the code around it.
- **A migration-related failure after merging**: check migration order (see
  `koomerce-release-flow`).
- **A sweep fails on an allow-list**: fix the violation, or add an entry with a real one-line
  reason; stale entries fail too (`docs/guardrails.md`, "The ratchet pattern").
