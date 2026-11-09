/** SOURCE OF TRUTH: pre-order campaigns on imported themes — a sold-out product in an active campaign reads as available (pre-order) in Liquid, as on its product page, so collection cards stop saying "Sold out" */
import { createDb, preorderCampaign, product, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createProduct } from '../catalog/products'
import { loadProducts } from './product-data'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function soldOutInCampaign(status: 'active' | 'paused' | null) {
  const [s] = await owner
    .insert(store)
    .values({ slug: `w-${status}`, name: 'W' })
    .returning()
  const storeId = s?.id as string
  const id = await withStore(app, storeId, (tx) =>
    createProduct(tx, storeId, {
      title: 'X2F CrazyLight',
      status: 'active',
      options: [],
      variants: [{ optionValues: [], pricePaise: 1_449_900, trackInventory: true }],
    }),
  )
  if (status) {
    const [c] = await owner
      .insert(preorderCampaign)
      .values({ storeId, name: 'November', status })
      .returning()
    await owner
      .update(product)
      .set({ preorderCampaignId: c?.id as string })
      .where(eq(product.id, id))
  }
  const [p] = await withStore(app, storeId, (tx) => loadProducts(tx, [id]))
  return p
}

describe('pre-order campaigns on Liquid product cards', () => {
  it('sells a sold-out product in an active campaign as a pre-order', async () => {
    const p = await soldOutInCampaign('active')
    expect(p?.preorder).toBe(true)
    expect(p?.variants.map((v) => [v.available, v.preorder])).toEqual([[true, true]])
  })

  it('stays sold out without a campaign, or when the campaign is not active', async () => {
    for (const status of [null, 'paused'] as const) {
      const p = await soldOutInCampaign(status)
      expect(p?.preorder).toBe(false)
      expect(p?.variants.map((v) => v.available)).toEqual([false])
    }
  })
})
