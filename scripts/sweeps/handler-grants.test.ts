/**
 * Sweep: a router handler never checks a change grant itself. A role's "Needs approval" tick
 * holds a call back in one place, `storeProcedureWith` (`packages/api/src/procedures/store.ts`),
 * before the handler runs; a `scope.can(permissions.ORDERS_CANCEL)` inside the handler skips
 * that hold. That is how the orders table's "Cancel order" (`orders.setStatus`) ran at once while
 * the order page's (`orders.cancel`) waited for approval. Name the extra grant on the procedure
 * instead: `can(permissions.ORDERS_WRITE, (input) => [...])` (`procedures/also-needs.ts`).
 *
 * Reads (`*_READ`) never wait, so checking one inside a handler is fine. A check on a grant held
 * in a variable is listed here with the reason it only decides what a read shows.
 *
 * Ratchet: a NEW in-handler change-grant check fails until it moves onto the procedure or is
 * listed with a reason; a listed one that is gone fails too, so the list never goes stale.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT } from './walk'

const ALLOWLIST: Record<string, string> = {
  'inbox.ts: scope.can(needed)': 'products.read or discounts.read for a shared card (reads only)',
  'metaobjects.ts: scope.can(needed)':
    "the record's read grant for listing extra fields; writes name theirs on setMetafields",
  'shell.ts: scope.can(permission)': 'which parts of the admin layout to read (reads only)',
  'store-data.ts: scope.can(permissions.SETTINGS_MANAGE)':
    'whether the overview lists exports; making one is its own settings.manage procedure',
  'metaobjects.ts: scope.can(permissions.CONTENT_MANAGE_TYPES)':
    'whoever manages the field types may list fields for any record (a read)',
}

const ROUTERS = path.join(ROOT, 'packages/api/src/routers')
const CHECK = /\bscope\.can\(([^)]*)\)/g

/** `<file>: scope.can(<arg>)` for every check on something other than a read grant. */
function changeGrantChecks(): string[] {
  const sites = new Set<string>()
  for (const file of readdirSync(ROUTERS)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .sort()) {
    for (const m of readFileSync(path.join(ROUTERS, file), 'utf8').matchAll(CHECK)) {
      const arg = m[1]?.trim() ?? ''
      if (/^permissions\.\w+_READ$/.test(arg)) continue
      sites.add(`${file}: scope.can(${arg})`)
    }
  }
  return [...sites]
}

describe('handler grants', () => {
  const found = changeGrantChecks()

  it('names extra change grants on the procedure, never inside the handler', () => {
    expect(found.filter((s) => !(s in ALLOWLIST))).toEqual([])
  })

  it('has no stale entries', () => {
    const present = new Set(found)
    expect(Object.keys(ALLOWLIST).filter((s) => !present.has(s))).toEqual([])
  })
})
