/**
 * Sweep: a `'use client'` module must not VALUE-import anything from a server-only
 * package (db, core, auth, storage, payments, shipping connectors, api). `import type`
 * is fine — only runtime values drag the server code (and its secrets/drivers) into the
 * browser bundle. `scripts/check-components.ts` already enforces this for
 * `@commerce/core`/`@commerce/db` as part of `bun run lint`; this sweep re-asserts that
 * and extends it to the rest of the server-only surface named in docs/guardrails.md.
 *
 * Ratchet: today's exceptions are frozen in ALLOWLIST with a reason. New violations fail.
 */
import { describe, expect, it } from 'vitest'
import {
  isClientDirective,
  listFiles,
  loadSourceFile,
  parseImports,
  SERVER_ONLY_PACKAGES,
  toRel,
} from './walk'

type AllowEntry = { file: string; specifier: string; reason: string }

const ALLOWLIST: AllowEntry[] = [
  {
    file: 'apps/admin/src/components/apps/delhivery/connect-page.tsx',
    specifier: '@commerce/shipping-delhivery',
    reason: 'imports only a public constant (DELHIVERY_STAGING_URL), no server code runs',
  },
  {
    file: 'apps/admin/src/components/apps/delhivery/overview-page.tsx',
    specifier: '@commerce/shipping-delhivery',
    reason: 'imports only a public constant (DELHIVERY_CAPABILITIES), no server code runs',
  },
  {
    file: 'apps/admin/src/components/apps/shiprocket/overview-page.tsx',
    specifier: '@commerce/shipping-shiprocket',
    reason: 'imports only a public constant (SHIPROCKET_CAPABILITIES), no server code runs',
  },
]

function isAllowlisted(file: string, specifier: string): boolean {
  return ALLOWLIST.some((e) => e.file === file && e.specifier === specifier)
}

async function findViolations(): Promise<{ file: string; specifier: string }[]> {
  const files = await listFiles(['apps', 'packages'], { includeTests: false })
  const violations: { file: string; specifier: string }[] = []
  for (const f of files) {
    const sf = loadSourceFile(f)
    if (!isClientDirective(sf)) continue
    const rel = toRel(f)
    for (const imp of parseImports(sf)) {
      if (imp.hasValue && SERVER_ONLY_PACKAGES.has(imp.specifier)) {
        violations.push({ file: rel, specifier: imp.specifier })
      }
    }
  }
  return violations
}

describe('sweep: client-imports-server', () => {
  it("no 'use client' module value-imports a server-only package outside the allow-list", async () => {
    const violations = await findViolations()
    const unlisted = violations.filter((v) => !isAllowlisted(v.file, v.specifier))
    expect(
      unlisted,
      `client code importing server-only values:\n${unlisted.map((v) => `${v.file} -> ${v.specifier}`).join('\n')}`,
    ).toEqual([])
  })

  it('the allow-list has no stale entries', async () => {
    const violations = await findViolations()
    const stale = ALLOWLIST.filter(
      (e) => !violations.some((v) => v.file === e.file && v.specifier === e.specifier),
    )
    expect(stale).toEqual([])
  })
})
