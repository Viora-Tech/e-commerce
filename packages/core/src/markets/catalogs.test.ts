/** SOURCE OF TRUTH: catalog tests — WHAT: catalog price math on top of a market's conversion, fixed prices, the rupee rule, which products a market sells (cart, checkout and listings), store isolation / WHY: catalogs change what shoppers abroad see and may buy; India without one must not change */

import {
  catalog,
  collection,
  collectionProduct,
  createDb,
  market,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { presentmentMinor, RUPEE_PRICING } from '@commerce/money'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { addToCart, createCart } from '../cart/cart'
import type { StoreContext } from '../context'
import { NotSoldInMarket } from '../errors'
import { catalogProductPrices } from './catalog-product-prices'
import { combineAdjustments, soldInRequestCatalog, withCatalogPricing } from './catalog-rules'
import {
  createCatalog,
  deleteCatalog,
  getCatalog,
  listCatalogs,
  storeMarketCatalogs,
  unsoldInMarket,
  updateCatalog,
} from './catalogs'
import { storeMarketPricing } from './rates'
import { createMarket, ensurePrimaryMarket, listMarkets } from './service'

const usd = { currency: 'USD', rate: 0.012, adjustmentBp: 1000, rounding: 'none' as const }

describe('catalog pricing', () => {
  it('compounds the catalog percent after the market’s own adjustment', () => {
    expect(combineAdjustments(1000, -1000)).toBe(-100)
    expect(combineAdjustments(0, 500)).toBe(500)
    const p = withCatalogPricing(usd, { adjustmentBp: -1000, fixedMinor: {} })
    // ₹1,000 → $12, +10% → $13.20, −10% → $11.88.
    expect(p && presentmentMinor(100_000, p)).toBe(1188)
  })

  it('rounds after both adjustments, with the market’s rule', () => {
    const p = withCatalogPricing(
      { ...usd, rounding: 'x99' },
      { adjustmentBp: -1000, fixedMinor: {} },
    )
    expect(p && presentmentMinor(100_000, p)).toBe(1199)
  })

  it('uses a fixed price as typed for its variant only', () => {
    const p = withCatalogPricing(usd, { adjustmentBp: 0, fixedMinor: { v1: 999 } })
    expect(p && presentmentMinor(100_000, p, 'v1')).toBe(999)
    expect(p && presentmentMinor(100_000, p, 'v2')).toBe(1320)
    // A whole line or a discount is never a fixed unit price.
    expect(p && presentmentMinor(100_000, p)).toBe(1320)
    expect(p && presentmentMinor(-5_000, p, 'v1')).toBe(-66)
  })

  it('leaves a rupee market and a market without a catalog exactly as they are', () => {
    expect(withCatalogPricing(RUPEE_PRICING, { adjustmentBp: -1000, fixedMinor: { v1: 5 } })).toBe(
      RUPEE_PRICING,
    )
    expect(withCatalogPricing(usd, null)).toBe(usd)
    expect(withCatalogPricing(null, { adjustmentBp: 500, fixedMinor: {} })).toBeNull()
    expect(withCatalogPricing(usd, { adjustmentBp: 0, fixedMinor: {} })).toBe(usd)
  })
})

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
  const storeId = s?.id as string
  await withStore(app, storeId, (tx) => ensurePrimaryMarket(tx, storeId))
  return storeId
}

async function newProduct(storeId: string, handle: string) {
  const [p] = await owner
    .insert(product)
    .values({ storeId, handle, title: handle, status: 'active' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({
      storeId,
      productId: p?.id as string,
      title: 'Default',
      pricePaise: 100_000,
      trackInventory: false,
    })
    .returning()
  return { productId: p?.id as string, variantId: v?.id as string }
}

const inStore = <T>(storeId: string, fn: (ctx: StoreContext) => Promise<T>) =>
  withStore(app, storeId, (tx) => fn({ storeId, tx }))

describe('catalogs', () => {
  it('sells only its chosen products and collections in its markets', async () => {
    const storeId = await newStore('waimers')
    const shirt = await newProduct(storeId, 'shirt')
    const cap = await newProduct(storeId, 'cap')
    const mug = await newProduct(storeId, 'mug')
    const [col] = await owner
      .insert(collection)
      .values({ storeId, handle: 'hats', title: 'Hats' })
      .returning()
    await owner
      .insert(collectionProduct)
      .values({ storeId, collectionId: col?.id as string, productId: cap.productId, position: 0 })
    const gulf = await inStore(storeId, (ctx) =>
      createMarket(ctx, { name: 'Gulf', countries: ['AE'], currency: 'AED', subfolder: 'ae' }),
    )
    const india = (await inStore(storeId, listMarkets)).find((m) => m.isPrimary)

    const made = await inStore(storeId, (ctx) =>
      createCatalog(ctx, {
        name: 'Gulf range',
        scope: 'chosen',
        productIds: [shirt.productId],
        collectionIds: [col?.id as string],
        marketIds: [gulf.id],
        priceAdjustmentBp: -1000,
        prices: [{ variantId: shirt.variantId, currency: 'AED', amountMinor: 4900 }],
      }),
    )
    expect(made).toMatchObject({ productCount: 2, fixedPriceCount: 1, markets: [{ id: gulf.id }] })

    const all = [shirt.productId, cap.productId, mug.productId]
    expect(await inStore(storeId, (ctx) => unsoldInMarket(ctx.tx, gulf.id, all))).toEqual([
      mug.productId,
    ])
    // India has no catalog: everything sells, as before.
    expect(await inStore(storeId, (ctx) => unsoldInMarket(ctx.tx, india?.id, all))).toEqual([])
    expect(await inStore(storeId, (ctx) => unsoldInMarket(ctx.tx, null, all))).toEqual([])

    // The cart refuses the mug in the Gulf, keeps the market, and takes it in India.
    const cartId = await inStore(storeId, (ctx) => createCart(ctx))
    await expect(
      inStore(storeId, (ctx) => addToCart(ctx, cartId, mug.variantId, 1, { marketId: gulf.id })),
    ).rejects.toBeInstanceOf(NotSoldInMarket)
    await inStore(storeId, (ctx) => addToCart(ctx, cartId, cap.variantId, 1, { marketId: gulf.id }))
    const indiaCart = await inStore(storeId, (ctx) => createCart(ctx))
    await inStore(storeId, (ctx) =>
      addToCart(ctx, indiaCart, mug.variantId, 1, { marketId: india?.id }),
    )

    // Listings with the request's catalog set show only its products.
    const listed = await withStore(
      app,
      storeId,
      (tx) => tx.select({ id: product.id }).from(product).where(soldInRequestCatalog(product.id)),
      { catalogId: made.id },
    )
    expect(listed.map((r) => r.id).sort()).toEqual([shirt.productId, cap.productId].sort())
    const everything = await withStore(app, storeId, (tx) =>
      tx.select({ id: product.id }).from(product).where(soldInRequestCatalog(product.id)),
    )
    expect(everything).toHaveLength(3)

    // The storefront's pricing for the Gulf carries the catalog; India's is untouched.
    const catalogs = await inStore(storeId, (ctx) => storeMarketCatalogs(ctx.tx))
    expect(catalogs.get(gulf.id)).toMatchObject({
      chosen: true,
      pricing: { adjustmentBp: -1000, fixedMinor: { [shirt.variantId]: 4900 } },
    })
    await owner.update(market).set({ manualRate: '0.044' }).where(eq(market.id, gulf.id))
    const pricing = await inStore(storeId, (ctx) => storeMarketPricing(ctx.tx))
    expect(pricing.get(gulf.id)).toMatchObject({
      adjustmentBp: -1000,
      fixedMinor: { [shirt.variantId]: 4900 },
    })
    expect(pricing.get(india?.id as string)).toEqual(RUPEE_PRICING)
  })

  it('stops applying as a draft, and refuses price changes in a rupee market', async () => {
    const storeId = await newStore('waimers')
    const mug = await newProduct(storeId, 'mug')
    const india = (await inStore(storeId, listMarkets)).find((m) => m.isPrimary)
    const c = await inStore(storeId, (ctx) =>
      createCatalog(ctx, { name: 'India', scope: 'chosen', marketIds: [india?.id as string] }),
    )
    expect(
      await inStore(storeId, (ctx) => unsoldInMarket(ctx.tx, india?.id, [mug.productId])),
    ).toEqual([mug.productId])
    await inStore(storeId, (ctx) => updateCatalog(ctx, { id: c.id, status: 'draft' }))
    expect(
      await inStore(storeId, (ctx) => unsoldInMarket(ctx.tx, india?.id, [mug.productId])),
    ).toEqual([])
    await expect(
      inStore(storeId, (ctx) => updateCatalog(ctx, { id: c.id, priceAdjustmentBp: 500 })),
    ).rejects.toThrow(/rupees/)

    // A market moves to the catalog it is given; deleting a catalog frees its markets.
    const other = await inStore(storeId, (ctx) =>
      createCatalog(ctx, { name: 'Other', marketIds: [india?.id as string] }),
    )
    expect((await inStore(storeId, (ctx) => getCatalog(ctx, c.id))).markets).toEqual([])
    await inStore(storeId, (ctx) => deleteCatalog(ctx, other.id))
    const [m] = await owner
      .select({ catalogId: market.catalogId })
      .from(market)
      .where(eq(market.id, india?.id as string))
    expect(m?.catalogId).toBeNull()
  })

  it('keeps catalogs to their own store', async () => {
    const a = await newStore('a')
    const b = await newStore('b')
    const pb = await newProduct(b, 'theirs')
    await inStore(a, (ctx) => createCatalog(ctx, { name: 'A' }))
    expect(await inStore(b, listCatalogs)).toEqual([])
    await expect(
      inStore(a, (ctx) =>
        createCatalog(ctx, { name: 'X', scope: 'chosen', productIds: [pb.productId] }),
      ),
    ).rejects.toThrow(/no longer exists/)
    const [n] = await owner.select({ n: sql<number>`count(*)::int` }).from(catalog)
    expect(n?.n).toBe(1)
  })
})

describe('catalog price table (audit #161)', () => {
  it('pages the included and excluded products with their variants', async () => {
    const storeId = await newStore('waimers')
    const shirt = await newProduct(storeId, 'shirt')
    await newProduct(storeId, 'cap')
    const chosen = await inStore(storeId, (ctx) =>
      createCatalog(ctx, { name: 'Abroad', scope: 'chosen', productIds: [shirt.productId] }),
    )
    const all = await inStore(storeId, (ctx) => createCatalog(ctx, { name: 'All' }))
    const inChosen = await inStore(storeId, (ctx) => catalogProductPrices(ctx, { id: chosen.id }))
    expect(inChosen.total).toBe(1)
    expect(inChosen.rows[0]?.variants).toEqual([
      { variantId: shirt.variantId, title: 'Default', pricePaise: 100_000 },
    ])
    const out = await inStore(storeId, (ctx) =>
      catalogProductPrices(ctx, { id: chosen.id, included: false }),
    )
    expect(out.rows.map((r) => r.title)).toEqual(['cap'])
    const allOut = await inStore(storeId, (ctx) =>
      catalogProductPrices(ctx, { id: all.id, included: false }),
    )
    expect(allOut.total).toBe(0)
    const searched = await inStore(storeId, (ctx) =>
      catalogProductPrices(ctx, { id: all.id, search: 'ca' }),
    )
    expect(searched.rows.map((r) => r.title)).toEqual(['cap'])
  })
})
