/** SOURCE OF TRUTH: monthly expense service tests — WHAT: create, versioned edits, delete, store isolation / WHY: past months must never change */
import { createDb, monthlyExpense, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { StoreContext } from '../context'
import {
  createMonthlyExpense,
  deleteMonthlyExpense,
  listMonthlyExpenses,
  updateMonthlyExpense,
} from './monthly-expense-service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

async function newStore(slug: string) {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  return s?.id as string
}

const inStore = <T>(storeId: string, fn: (ctx: StoreContext) => Promise<T>) =>
  withStore(app, storeId, (tx) => fn({ storeId, tx }))

describe('monthly expenses', () => {
  it('a change from a later month keeps the earlier months as they were', async () => {
    const storeId = await newStore('waimers')
    const rent = await inStore(storeId, (ctx) =>
      createMonthlyExpense(ctx, {
        name: 'Rent',
        category: 'rent',
        amountPaise: 2_500_000,
        startsOn: '2026-01',
      }),
    )
    const next = await inStore(storeId, (ctx) =>
      updateMonthlyExpense(ctx, {
        id: rent.id,
        name: 'Rent',
        category: 'rent',
        amountPaise: 3_000_000,
        fromMonth: '2026-07',
        endsOn: null,
      }),
    )
    expect(next).toMatchObject({ seriesId: rent.id, startsOn: '2026-07', endsOn: null })
    const versions = await inStore(storeId, listMonthlyExpenses)
    expect(versions.map((v) => [v.startsOn, v.endsOn, v.amountPaise])).toEqual([
      ['2026-01', '2026-06', 2_500_000],
      ['2026-07', null, 3_000_000],
    ])

    // From its own first month: changed in place.
    await inStore(storeId, (ctx) =>
      updateMonthlyExpense(ctx, {
        id: next.id,
        name: 'Shop rent',
        category: 'rent',
        amountPaise: 3_200_000,
        fromMonth: '2026-07',
        endsOn: '2026-12',
      }),
    )
    expect((await inStore(storeId, listMonthlyExpenses)).length).toBe(2)

    await expect(
      inStore(storeId, (ctx) =>
        updateMonthlyExpense(ctx, {
          id: next.id,
          name: 'Rent',
          category: 'rent',
          amountPaise: 1,
          fromMonth: '2027-03',
          endsOn: null,
        }),
      ),
    ).rejects.toThrow('already ended')
  })

  it('delete removes every version; other stores never see or touch it', async () => {
    const a = await newStore('a-store')
    const b = await newStore('b-store')
    const tool = await inStore(a, (ctx) =>
      createMonthlyExpense(ctx, { name: 'Shopify', amountPaise: 199_900, startsOn: '2026-03' }),
    )
    expect(tool.category).toBe('other')
    expect(await inStore(b, listMonthlyExpenses)).toEqual([])
    await expect(inStore(b, (ctx) => deleteMonthlyExpense(ctx, { id: tool.id }))).rejects.toThrow()
    await inStore(a, (ctx) => deleteMonthlyExpense(ctx, { id: tool.id }))
    expect(await inStore(a, listMonthlyExpenses)).toEqual([])
    const rows = await owner.select().from(monthlyExpense)
    expect(rows.every((r) => r.archivedAt !== null)).toBe(true)
  })

  it('refuses a last month before the first', async () => {
    const storeId = await newStore('waimers')
    await expect(
      inStore(storeId, (ctx) =>
        createMonthlyExpense(ctx, {
          name: 'Ads',
          amountPaise: 100,
          startsOn: '2026-05',
          endsOn: '2026-04',
        }),
      ),
    ).rejects.toThrow()
  })
})
