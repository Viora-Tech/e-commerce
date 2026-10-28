/** SOURCE OF TRUTH: imported themes in a market's currency tests — WHAT: product and variant prices, `shop.currency`, `| money` and `shop.money_format` follow the page's market pricing; rupees stay as they were without one / WHY: a shopper on `/ae` must see dirhams in the theme's markup and its scripts alike */
import { createDb, product, store, variant, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { type MarketPricing, presentmentCents } from '../markets/presentment'
import { storeLiquidData } from './data'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const USD: MarketPricing = { currency: 'USD', rate: 0.012, adjustmentBp: 0, rounding: 'x99' }

async function seed() {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'W' }).returning()
  const storeId = s?.id as string
  const [p] = await owner
    .insert(product)
    .values({ storeId, handle: 'pad', title: 'Pad', status: 'active' })
    .returning()
  await owner.insert(variant).values({
    storeId,
    productId: p?.id as string,
    title: 'Default',
    pricePaise: 64_900,
    mrpPaise: 99_900,
    trackInventory: false,
  })
  return storeId
}

const read = (storeId: string, pricing: MarketPricing | null) =>
  withStore(app, storeId, async (tx) => {
    const source = await storeLiquidData(tx, {
      storeId,
      host: 'w.in',
      origin: 'https://w.in',
      pricing,
    })
    return { shop: source.shop, pad: await source.product('pad') }
  })

describe('imported theme prices in a market', () => {
  it('converts variant prices and compare-at prices into hundredths of the market currency', async () => {
    const storeId = await seed()
    const { shop, pad } = await read(storeId, USD)
    expect(shop.currency).toBe('USD')
    // ₹649 → $7.788 → $7.99; ₹999 → $11.988 → $11.99
    expect(pad?.variants[0]?.price).toBe(799)
    expect(pad?.variants[0]?.compareAtPrice).toBe(1199)
  })

  it('keeps paise without a market', async () => {
    const storeId = await seed()
    const { shop, pad } = await read(storeId, null)
    expect(shop.currency).toBe('INR')
    expect(pad?.variants[0]?.price).toBe(64_900)
    expect(pad?.variants[0]?.compareAtPrice).toBe(99_900)
  })
})

describe('presentmentCents', () => {
  it('holds dinars and yen in hundredths, as Shopify does', () => {
    const kwd: MarketPricing = { currency: 'KWD', rate: 0.00367, adjustmentBp: 0, rounding: 'none' }
    // ₹1,000 → KWD 3.670 → 367 hundredths
    expect(presentmentCents(100_000, kwd)).toBe(367)
    const jpy: MarketPricing = { currency: 'JPY', rate: 1.79, adjustmentBp: 0, rounding: 'none' }
    // ₹1,000 → ¥1,790 → 179000 hundredths
    expect(presentmentCents(100_000, jpy)).toBe(179_000)
    expect(presentmentCents(100_000, null)).toBe(100_000)
  })
})
