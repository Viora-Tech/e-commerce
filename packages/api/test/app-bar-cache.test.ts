import { beforeEach, describe, expect, it, vi } from 'vitest'

let reads = 0
let fail = false
vi.mock('@commerce/core/registries', () => ({
  getRegistries: () => ({
    plugins: [
      {
        id: 'demo',
        appBar: async ({ can }: { can: (p: string) => boolean }) => {
          reads++
          if (fail) throw new Error('read failed')
          return {
            statusPill: { label: 'Connected', tone: 'success' },
            pageCounts: can('orders.read') ? { queue: 6 } : {},
          }
        },
      },
    ],
  }),
}))

const { APP_BAR_TTL_MS, clearAppBarCache, installedAppBars } = await import(
  '../src/services/app-bar.service'
)

// A savepoint that just runs the read: the cache, not the database, is under test.
const tx = { transaction: (fn: (sp: unknown) => unknown) => fn(tx) } as never
const installed = new Set(['demo'])
const owner = () => true
const packer = (p: string) => p !== 'orders.read'

describe('app bar cache', () => {
  beforeEach(() => {
    reads = 0
    fail = false
    clearAppBarCache()
  })

  it('reads once per store and minute, then reuses the answer', async () => {
    const first = await installedAppBars(tx, 's1', installed, owner, 0)
    const again = await installedAppBars(tx, 's1', installed, owner, APP_BAR_TTL_MS - 1)
    expect(again).toEqual(first)
    expect(first.demo?.pageCounts).toEqual({ queue: 6 })
    expect(reads).toBe(1)
    await installedAppBars(tx, 's1', installed, owner, APP_BAR_TTL_MS + 1)
    expect(reads).toBe(2)
  })

  it('never shows a count to a member the read would have hidden it from', async () => {
    await installedAppBars(tx, 's1', installed, owner, 0)
    const forPacker = await installedAppBars(tx, 's1', installed, packer, 10)
    expect(forPacker.demo?.pageCounts).toEqual({})
    expect(reads).toBe(2)
  })

  it('keeps stores apart and does not remember a failed read', async () => {
    await installedAppBars(tx, 's1', installed, owner, 0)
    await installedAppBars(tx, 's2', installed, owner, 0)
    expect(reads).toBe(2)
    fail = true
    clearAppBarCache()
    expect(await installedAppBars(tx, 's1', installed, owner, 0)).toEqual({})
    fail = false
    await installedAppBars(tx, 's1', installed, owner, 1)
    expect(reads).toBe(4)
  })
})
