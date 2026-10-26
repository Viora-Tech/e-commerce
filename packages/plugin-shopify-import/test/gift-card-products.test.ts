/**
 * Shopify gift card products import as gift cards here (`product.isGiftCard`), shaped like
 * the ones the gift cards page makes: untracked, untaxed, weightless. A re-import follows
 * Shopify's flag both ways. Fake Admin API and in-memory storage only.
 */
import { product, variant, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { asc, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { connect } from '../src/connection'
import { parseProductsCsv } from '../src/csv-products'
import { giftCardFrom } from '../src/gift-card-products'
import { executeRun } from '../src/run'
import { createApiRun, createCsvRun, startRun } from '../src/service'
import { mapProduct } from '../src/shopify-api'
import { fakeShopify, productNode } from './fixtures/fake-shopify'
import {
  app,
  deps,
  fakeFetch,
  json,
  MemoryStorageProvider,
  owner,
  SECRET,
  seedStore,
} from './helpers'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const HEADER =
  'Handle,Title,Type,Option1 Name,Option1 Value,Variant SKU,Variant Grams,Variant Inventory Tracker,Variant Inventory Qty,Variant Price,Variant Taxable,Gift Card,Status'

const csvOf = (...rows: string[]) => [HEADER, ...rows].join('\n')

async function importCsv(storeId: string, storage: MemoryStorageProvider, csv: string) {
  const d = deps(storeId, storage, { fetch: fakeFetch(() => json({})) })
  const run = await withStore(app, storeId, (tx) =>
    createCsvRun(tx, storeId, storage, {
      resource: 'products',
      fileName: 'products.csv',
      csv,
      createdBy: 'owner@example.com',
    }),
  )
  await executeRun(d, run.id)
  await withStore(app, storeId, (tx) => startRun(tx, run.id))
  await executeRun(d, run.id)
}

describe('gift card signal', () => {
  it('prefers an explicit flag, then the product type or template', () => {
    expect(giftCardFrom({ flag: false, productType: 'Gift Card' })).toBe(false)
    expect(giftCardFrom({ flag: true })).toBe(true)
    expect(giftCardFrom({ productType: 'Gift Card' })).toBe(true)
    expect(giftCardFrom({ productType: 'gift cards' })).toBe(true)
    expect(giftCardFrom({ templateSuffix: 'gift_card' })).toBe(true)
    expect(giftCardFrom({ productType: 'Mice' })).toBeUndefined()
  })

  it('reads the CSV Gift Card column and shapes the variants', () => {
    const { products } = parseProductsCsv(
      csvOf(
        'gc,Gift card,,Denomination,₹500,GC-500,200,shopify,4,500,true,true,active',
        'gc,,,,₹1000,GC-1000,200,shopify,4,1000,true,,',
        'mouse,Mouse,Mice,,,M-1,80,shopify,5,999,true,false,active',
        'typed,Typed card,Gift Card,,,T-1,,,,250,true,,active',
      ),
    )
    const [gc, mouse, typed] = products
    expect(gc?.isGiftCard).toBe(true)
    expect(gc?.variants.map((v) => [v.taxable, v.trackInventory, v.weightGrams, v.onHand])).toEqual(
      [
        [false, false, 0, null],
        [false, false, 0, null],
      ],
    )
    expect(mouse?.isGiftCard).toBe(false)
    expect(mouse?.variants[0]?.trackInventory).toBe(true)
    expect(typed?.isGiftCard).toBe(true)
  })

  it('a CSV without the column and an ordinary type leaves the flag alone', () => {
    const { products } = parseProductsCsv('Handle,Title,Type,Variant Price\nmouse,Mouse,Mice,999')
    expect(products[0]?.isGiftCard).toBeUndefined()
  })

  it('maps the Admin API isGiftCard flag', () => {
    const node = productNode(5, { isGiftCard: true, productType: 'Vouchers' }) as never
    const mapped = mapProduct(node, (node as { variants: { nodes: never[] } }).variants.nodes)
    expect(mapped.isGiftCard).toBe(true)
    expect(mapped.variants[0]).toMatchObject({ taxable: false, trackInventory: false })
    const plain = productNode(6) as never
    expect(
      mapProduct(plain, (plain as { variants: { nodes: never[] } }).variants.nodes).isGiftCard,
    ).toBe(false)
  })
})

describe('gift card import', () => {
  it('imports a gift card from the Admin API', async () => {
    const fake = fakeShopify({ customers: 0, orders: 0, products: 0 })
    fake.data.products = [productNode(1), productNode(2, { isGiftCard: true, title: 'Card' })]
    const fetchImpl = fake.wrap(fakeFetch(fake.graphql))
    const storeId = await seedStore()
    await withStore(app, storeId, (tx) =>
      connect(
        tx,
        storeId,
        { shopDomain: 'waimers.myshopify.com', accessToken: 'shpat_0123456789abcdef' },
        SECRET,
        fetchImpl,
      ),
    )
    const d = deps(storeId, new MemoryStorageProvider(), {
      fetch: fetchImpl,
      sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 10))),
    })
    const run = await withStore(app, storeId, (tx) =>
      createApiRun(tx, storeId, { resources: ['products'], createdBy: null }),
    )
    await executeRun(d, run.id)
    await withStore(app, storeId, (tx) => startRun(tx, run.id))
    await executeRun(d, run.id)
    const rows = await owner
      .select({ handle: product.handle, isGiftCard: product.isGiftCard })
      .from(product)
      .orderBy(asc(product.handle))
    expect(rows).toEqual([
      { handle: 'product-2', isGiftCard: true },
      { handle: 'tee', isGiftCard: false },
    ])
  })

  it('a re-import turns the flag on and off with Shopify', async () => {
    const storeId = await seedStore()
    const storage = new MemoryStorageProvider()
    const plain = 'gc,Gift card,,,,GC-1,200,shopify,4,500,true,false,active'
    const card = 'gc,Gift card,,,,GC-1,200,shopify,4,500,true,true,active'

    await importCsv(storeId, storage, csvOf(plain))
    const flag = async () => {
      const [p] = await owner.select().from(product).where(eq(product.handle, 'gc'))
      const [v] = await owner
        .select()
        .from(variant)
        .where(eq(variant.productId, p?.id ?? ''))
      return { gift: p?.isGiftCard, tracked: v?.trackInventory, taxable: v?.taxable }
    }
    expect(await flag()).toEqual({ gift: false, tracked: true, taxable: true })

    await importCsv(storeId, storage, csvOf(card))
    expect(await flag()).toEqual({ gift: true, tracked: false, taxable: false })

    await importCsv(storeId, storage, csvOf(plain))
    expect(await flag()).toEqual({ gift: false, tracked: true, taxable: true })
  })
})
