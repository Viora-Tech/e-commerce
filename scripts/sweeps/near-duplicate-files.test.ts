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
    pair: 'apps/admin/src/components/blog/confirm-delete-articles.tsx <-> apps/admin/src/components/products/confirm-bulk-delete.tsx',
    reason:
      'two bulk-delete confirm dialogs with different copy and API calls — fold into one shared ConfirmBulkDelete with copy + action props',
  },
  {
    pair: 'apps/admin/src/components/customers/customer-tags-card.tsx <-> apps/admin/src/components/orders/tags-card.tsx',
    reason: 'customer and order tag cards — fold into one TagsCard with the save call as a prop',
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
