/** SOURCE OF TRUTH: hidden variants on imported themes (#934) — a variant hidden on the store is left out of the Liquid product, with the option values only it used */
import { createDb, store, variant, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { asc, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createProduct, updateProduct } from '../catalog/products'
import type { ProductWrite } from '../catalog/schemas'
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

const write = (hidePurple: boolean | undefined): ProductWrite => ({
  title: 'Blazing Sky X1',
  status: 'active',
  options: [{ name: 'Colour', values: [{ value: 'Red' }, { value: 'Purple' }] }],
  variants: [
    { optionValues: ['Red'], pricePaise: 0 },
    {
      optionValues: ['Purple'],
      pricePaise: 0,
      ...(hidePurple === undefined ? {} : { hiddenOnStore: hidePurple }),
    },
  ],
})

describe('hidden variants on imported themes (#934)', () => {
  it('leaves a hidden variant and its only option value out; a later write that does not say keeps it hidden', async () => {
    const [s] = await owner.insert(store).values({ slug: 'w', name: 'W' }).returning()
    const storeId = s?.id as string
    const id = await withStore(app, storeId, (tx) => createProduct(tx, storeId, write(true)))
    const [p] = await withStore(app, storeId, (tx) => loadProducts(tx, [id]))
    expect(p?.variants.map((v) => v.title)).toEqual(['Red'])
    expect(p?.options).toEqual([{ name: 'Colour', values: ['Red'] }])

    // An importer or bulk tool that does not know the setting leaves it alone.
    await withStore(app, storeId, (tx) => updateProduct(tx, storeId, id, write(undefined)))
    const rows = await owner
      .select({ title: variant.title, hidden: variant.hiddenOnStore })
      .from(variant)
      .where(eq(variant.productId, id))
      .orderBy(asc(variant.position))
    expect(rows).toEqual([
      { title: 'Red', hidden: false },
      { title: 'Purple', hidden: true },
    ])
  })
})
