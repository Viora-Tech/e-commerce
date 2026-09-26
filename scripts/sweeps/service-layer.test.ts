/**
 * Sweep: direct `@commerce/db` / `drizzle-orm` value-imports are only allowed in the
 * service layer (`packages/core`, `packages/db`, `packages/api/src/services`) and in
 * one-off scripts. Everywhere else — app routes, the worker, plugin packages — should
 * read/write through a core service instead of the raw db client.
 *
 * This sweep is a ratchet: it fails on any NEW file outside those roots that imports
 * `@commerce/db` or `drizzle-orm` as a value, but does not fail on today's existing
 * ones — those are frozen in ALLOWLIST below, each with a reason. Fixing a violation
 * means moving the query behind a `packages/core` (or `packages/api/src/services`)
 * function; allow-listing it means adding a folder/file entry here with why it's OK
 * for now. See docs/guardrails.md.
 */
import { describe, expect, it } from 'vitest'
import { listFiles, loadSourceFile, parseImports, toRel } from './walk'

const ALLOWED_ROOTS = [
  'packages/core/src/',
  'packages/db/',
  'packages/api/src/services/',
  'scripts/',
]

type AllowEntry = { path: string; exact?: boolean; reason: string }

const ALLOWLIST: AllowEntry[] = [
  {
    path: 'apps/admin/src/app/api/uploads/route.ts',
    exact: true,
    reason: 'legacy direct read in an upload route handler — move behind a core service',
  },
  {
    path: 'apps/admin/src/lib/db.ts',
    exact: true,
    reason: 'creates the Db connection for the admin app request context',
  },
  {
    path: 'apps/admin/src/app/api/health/route.ts',
    exact: true,
    reason:
      'infra liveness/readiness probe (Docker HEALTHCHECK) — deliberately a raw connectivity check, not a service call',
  },
  {
    path: 'apps/storefront/src/lib/db.ts',
    exact: true,
    reason: 'creates the Db connection for the storefront app request context',
  },
  {
    path: 'apps/storefront/src/proxy.ts',
    exact: true,
    reason: 'resolves the store from the db in middleware — move behind a core service',
  },
  {
    path: 'apps/storefront/src/app/',
    reason: 'storefront RSC pages/routes read the db directly — move behind a core service',
  },
  {
    path: 'apps/storefront/src/lib/',
    reason:
      'storefront lib helpers and server actions read the db directly — move behind a core service',
  },
  {
    path: 'apps/worker/src/',
    reason: 'worker jobs read/write the db directly; not yet routed through core services',
  },
  {
    path: 'packages/api/src/procedures/store.ts',
    exact: true,
    reason: 'resolves the store from the db in an oRPC procedure — not yet a service',
  },
  {
    path: 'packages/plugin-back-in-stock/src/',
    reason: 'plugin owns its own schema/queries; not yet routed through packages/core',
  },
  {
    path: 'packages/plugin-gst-invoices/src/',
    reason: 'plugin owns its own schema/queries; not yet routed through packages/core',
  },
  {
    path: 'packages/plugin-shopify-import/src/',
    reason: 'plugin owns its own schema/queries; not yet routed through packages/core',
  },
  {
    path: 'packages/plugin-shopify-import/test/helpers.ts',
    exact: true,
    reason: 'test helper seeds the db directly',
  },
]

function isAllowlisted(rel: string): boolean {
  return ALLOWLIST.some((e) => (e.exact ? rel === e.path : rel.startsWith(e.path)))
}

async function findViolations(): Promise<string[]> {
  const files = await listFiles(['apps', 'packages'], { includeTests: false })
  const violations: string[] = []
  for (const file of files) {
    const rel = toRel(file)
    if (ALLOWED_ROOTS.some((root) => rel.startsWith(root))) continue
    const sf = loadSourceFile(file)
    const hits = parseImports(sf).some(
      (imp) =>
        imp.hasValue &&
        (imp.specifier === '@commerce/db' || imp.specifier.startsWith('drizzle-orm')),
    )
    if (hits) violations.push(rel)
  }
  return violations.sort()
}

describe('sweep: service-layer', () => {
  it('every @commerce/db / drizzle-orm value-import outside the service layer is allow-listed', async () => {
    const violations = await findViolations()
    const unlisted = violations.filter((v) => !isAllowlisted(v))
    expect(
      unlisted,
      `new direct db access outside the service layer:\n${unlisted.join('\n')}`,
    ).toEqual([])
  })

  it('the allow-list has no stale entries (every entry still matches a real violation)', async () => {
    const violations = await findViolations()
    const staleExact = ALLOWLIST.filter((e) => e.exact && !violations.includes(e.path))
    const stalePrefix = ALLOWLIST.filter(
      (e) => !e.exact && !violations.some((v) => v.startsWith(e.path)),
    )
    expect([...staleExact, ...stalePrefix]).toEqual([])
  })
})
