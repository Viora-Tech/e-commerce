/**
 * Sweep: `server-only` on app server modules. A module under `apps/admin/src/lib` or
 * `apps/storefront/src/lib` that value-imports a server-only package (core, db, auth,
 * storage, payments, shipping, api) or `@commerce/config` (secrets) must start with
 * `import 'server-only'`, so a client component that reaches it is a build error instead of
 * a bundle carrying server code. (`'use client'` modules are the client-imports-server
 * sweep's business.) Tests alias `server-only` to an empty stub (see the storefront and api
 * vitest configs), because vitest does not set Next's `react-server` export condition.
 *
 * Ratchet: a NEW unguarded module fails (stale entries fail too).
 */
import { describe, expect, it } from 'vitest'
import { missingServerOnly } from './consistency'

type AllowEntry = { file: string; reason: string }

const ALLOWLIST: AllowEntry[] = []

describe('sweep: server-only-guard', () => {
  it('every app lib module that reaches server packages imports server-only', async () => {
    const files = await missingServerOnly()
    const unlisted = files.filter((f) => !ALLOWLIST.some((e) => e.file === f))
    expect(
      unlisted,
      `add \`import 'server-only'\` as the first line:\n${unlisted.join('\n')}`,
    ).toEqual([])
  })

  it('the allow-list has no stale entries', async () => {
    const files = await missingServerOnly()
    expect(ALLOWLIST.filter((e) => !files.includes(e.file))).toEqual([])
  })
})
