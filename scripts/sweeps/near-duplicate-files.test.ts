/**
 * Sweep: near-duplicate files. Two source files over 40 normalised lines (trimmed, no blanks,
 * imports or comments) that share at least 85% of their lines are a copy that will drift: make
 * one owner with options instead (find, extend, then create). Finder: `nearDuplicatePairs`.
 *
 * Ratchet: a NEW pair fails; fixing one means deleting its entry (stale entries fail too).
 */
import { describe, expect, it } from 'vitest'
import { nearDuplicatePairs } from './consistency'

type AllowEntry = { pair: string; reason: string }

const ALLOWLIST: AllowEntry[] = [
  {
    pair: 'apps/admin/src/components/customers/bulk-edit/customers-bulk-grid.tsx <-> apps/admin/src/components/orders/bulk-edit/orders-bulk-grid.tsx',
    reason:
      'customers and orders bulk-edit grids (same keyboard/paste wiring, own model and columns) — fold into one BulkGrid with model + columns props',
  },
]

describe('sweep: near-duplicate-files', () => {
  it('every near-duplicate file pair is allow-listed with a reason', async () => {
    const pairs = await nearDuplicatePairs()
    const unlisted = pairs.filter((p) => !ALLOWLIST.some((e) => e.pair === p))
    expect(unlisted, `new near-duplicate files (make one owner):\n${unlisted.join('\n')}`).toEqual(
      [],
    )
  })

  it('the allow-list has no stale entries', async () => {
    const pairs = await nearDuplicatePairs()
    expect(ALLOWLIST.filter((e) => !pairs.includes(e.pair))).toEqual([])
  })
})
