/** SOURCE OF TRUTH: tests for order numbers — WHAT: store_counter starts from the store row, catches up with it, moves past imports, never repeats under parallel checkouts / WHY: 0177 moved the counter off the store row */
import { createDb, store, storeCounter, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { bumpOrderNumberPast, takeOrderNumber } from './order-number'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

async function newStore(nextOrderNumber = 1) {
  const [s] = await owner
    .insert(store)
    .values({ slug: `s${nextOrderNumber}`, name: 'S', nextOrderNumber })
    .returning()
  if (!s) throw new Error('seed')
  return s.id
}

const take = (storeId: string) => withStore(app, storeId, (tx) => takeOrderNumber(tx, storeId))

const counterOf = async (storeId: string) =>
  (await owner.select().from(storeCounter).where(eq(storeCounter.storeId, storeId)))[0]?.value

describe('order numbers (store_counter)', () => {
  it("starts a new store's counter from its store row and counts up", async () => {
    const storeId = await newStore(1001)
    expect(await take(storeId)).toBe(1001)
    expect(await take(storeId)).toBe(1002)
    expect(await counterOf(storeId)).toBe(1003)
  })

  it('catches up with the store row an older build still counts on (rolling deploy)', async () => {
    const storeId = await newStore(10)
    expect(await take(storeId)).toBe(10)
    // An older build took 11 and 12 from the store row meanwhile.
    await owner.update(store).set({ nextOrderNumber: 13 }).where(eq(store.id, storeId))
    expect(await take(storeId)).toBe(13)
  })

  it('moves past an imported number without taking one', async () => {
    const storeId = await newStore(5)
    await withStore(app, storeId, (tx) => bumpOrderNumberPast(tx, storeId, 2400))
    expect(await counterOf(storeId)).toBe(2401)
    // A lower imported number never moves it back.
    await withStore(app, storeId, (tx) => bumpOrderNumberPast(tx, storeId, 100))
    expect(await take(storeId)).toBe(2401)
  })

  it('never hands the same number to two checkouts at once', async () => {
    const storeId = await newStore(1)
    const numbers = await Promise.all(Array.from({ length: 8 }, () => take(storeId)))
    expect(new Set(numbers).size).toBe(8)
    expect([...numbers].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })
})
