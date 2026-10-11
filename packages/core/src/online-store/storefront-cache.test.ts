/** SOURCE OF TRUTH: storefront cache schedule tests — the next scheduled change (launch, scheduled article, discount start or end) of one store only, or none */
import { article, blog, createDb, discount, product, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { nextScheduledChange } from './storefront-cache'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seedStore(slug: string) {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  return s.id
}

const hours = (n: number) => new Date(Date.now() + n * 3_600_000)

describe('nextScheduledChange', () => {
  it('is null when nothing is scheduled', async () => {
    const storeId = await seedStore('a')
    await owner.insert(product).values({ storeId, handle: 'p', title: 'P', launchAt: hours(-1) })
    expect(await withStore(app, storeId, (tx) => nextScheduledChange(tx))).toBeNull()
  })

  it('is the soonest future launch, article or discount boundary of this store only', async () => {
    const storeId = await seedStore('a')
    const other = await seedStore('b')
    await owner.insert(product).values([
      { storeId, handle: 'p', title: 'P', launchAt: hours(5) },
      { storeId: other, handle: 'q', title: 'Q', launchAt: hours(1) },
    ])
    const [b] = await owner
      .insert(blog)
      .values({ storeId, handle: 'news', title: 'News' })
      .returning()
    await owner.insert(article).values({
      storeId,
      blogId: b?.id as string,
      handle: 'soon',
      title: 'Soon',
      status: 'scheduled',
      publishedAt: hours(3),
    })
    await owner.insert(discount).values({
      storeId,
      title: 'Sale',
      code: 'SALE',
      method: 'percent',
      startsAt: hours(-2),
      endsAt: hours(2),
    })
    const at = await withStore(app, storeId, (tx) => nextScheduledChange(tx))
    expect(at?.getTime()).toBeCloseTo(hours(2).getTime(), -4)
  })
})
