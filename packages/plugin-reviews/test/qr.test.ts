import { withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { reviewQrLinks } from '../src/qr'
import { openRequestLink } from '../src/tokens'
import { addOrder, addProduct, app, owner, seedStore } from './helpers'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const opts = { secret: 'secret', storefrontUrl: 'https://shop.example' }

describe('reviewQrLinks', () => {
  it('gives an order one signed link per product, and a product its open link', async () => {
    const storeId = await seedStore()
    const a = await addProduct(storeId, 'veil')
    const b = await addProduct(storeId, 'cable')
    const o = await addOrder(storeId, {
      email: 'buyer@example.com',
      variantIds: [a.variantId, b.variantId],
    })
    const forOrder = await withStore(app, storeId, (tx) =>
      reviewQrLinks(tx, storeId, { kind: 'order', id: o.orderId }, opts),
    )
    expect(forOrder.orderNumber).toBe(o.number)
    expect(forOrder.links.map((l) => l.title).sort()).toEqual(['cable', 'veil'])
    for (const l of forOrder.links) {
      const token = new URL(l.url).searchParams.get('review')
      expect(openRequestLink('secret', token, storeId)).toMatchObject({
        orderId: o.orderId,
        productId: l.productId,
      })
    }
    const forProduct = await withStore(app, storeId, (tx) =>
      reviewQrLinks(tx, storeId, { kind: 'product', id: a.productId }, opts),
    )
    expect(forProduct.links).toEqual([
      {
        productId: a.productId,
        title: 'veil',
        url: 'https://shop.example/products/veil?write=1#reviews',
      },
    ])
  })

  it('has no links for another store\u2019s order', async () => {
    const storeId = await seedStore()
    const other = await seedStore()
    const a = await addProduct(other, 'veil')
    const o = await addOrder(other, { email: 'x@example.com', variantIds: [a.variantId] })
    const r = await withStore(app, storeId, (tx) =>
      reviewQrLinks(tx, storeId, { kind: 'order', id: o.orderId }, opts),
    )
    expect(r.links).toEqual([])
  })
})
