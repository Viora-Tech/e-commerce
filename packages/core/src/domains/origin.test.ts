/** SOURCE OF TRUTH: storefrontOriginFor tests — live primary domain wins, pending primary and no primary fall back, never another store's domain, localhost fallback kept in dev */
import { createDb, store, storeDomain, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { checkoutOrigin, checkoutOriginFor, storefrontOrigin, storefrontOriginFor } from './origin'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const FALLBACK = 'https://shop.platform.test/'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seedStore(slug: string): Promise<string> {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  return s.id
}

const originOf = (storeId: string, fallback = FALLBACK) =>
  withStore(app, storeId, (tx) => storefrontOriginFor(tx, storeId, fallback))

describe('storefrontOriginFor', () => {
  it('uses the active primary domain', async () => {
    const storeId = await seedStore('w')
    await owner.insert(storeDomain).values([
      { storeId, hostname: 'w.platform.test', isPrimary: false, status: 'active' },
      { storeId, hostname: 'kuldeepsaini.com', isPrimary: true, status: 'active' },
    ])
    expect(await originOf(storeId)).toBe('https://kuldeepsaini.com')
  })

  it('falls back to the platform URL (origin only) when the store has no primary', async () => {
    const storeId = await seedStore('w')
    await owner
      .insert(storeDomain)
      .values({ storeId, hostname: 'w.platform.test', isPrimary: false, status: 'active' })
    expect(await originOf(storeId)).toBe('https://shop.platform.test')
  })

  it('ignores a primary that is not active yet', async () => {
    const storeId = await seedStore('w')
    await owner
      .insert(storeDomain)
      .values({ storeId, hostname: 'brand.test', isPrimary: true, status: 'pending' })
    expect(await originOf(storeId)).toBe('https://shop.platform.test')
  })

  it("never returns another store's domain", async () => {
    const a = await seedStore('a')
    const b = await seedStore('b')
    await owner
      .insert(storeDomain)
      .values({ storeId: b, hostname: 'b.test', isPrimary: true, status: 'active' })
    expect(await originOf(a)).toBe('https://shop.platform.test')
    expect(await originOf(b)).toBe('https://b.test')
  })
})

describe('storefrontOrigin', () => {
  it('keeps the localhost fallback in development, port included', () => {
    expect(storefrontOrigin('kuldeepsaini.com', 'http://localhost:3100')).toBe(
      'http://localhost:3100',
    )
    expect(storefrontOrigin(null, 'http://waimers.localhost:3100/x')).toBe(
      'http://waimers.localhost:3100',
    )
  })
})

describe('checkoutOrigin', () => {
  it('builds the branded per-store checkout origin from the subdomain and primary host', () => {
    expect(checkoutOrigin('waimers.com', 'checkout', FALLBACK)).toBe('https://checkout.waimers.com')
    expect(checkoutOrigin('shop.koomerce.app', 'checkout', FALLBACK)).toBe(
      'https://checkout.shop.koomerce.app',
    )
  })
  it('falls back to the store origin when the subdomain is unset (flag off)', () => {
    expect(checkoutOrigin('waimers.com', null, FALLBACK)).toBe(
      storefrontOrigin('waimers.com', FALLBACK),
    )
  })
  it('falls back to the platform origin when there is no primary host', () => {
    expect(checkoutOrigin(null, 'checkout', FALLBACK)).toBe(storefrontOrigin(null, FALLBACK))
  })
  it('does not brand in development, where the fallback is localhost', () => {
    expect(checkoutOrigin('waimers.com', 'checkout', 'http://localhost:3100')).toBe(
      'http://localhost:3100',
    )
  })
})

const checkoutOf = (storeId: string, subdomain: string | null, fallback = FALLBACK) =>
  withStore(app, storeId, (tx) => checkoutOriginFor(tx, storeId, subdomain, fallback))

describe('checkoutOriginFor', () => {
  it('brands the active primary domain', async () => {
    const storeId = await seedStore('w')
    await owner
      .insert(storeDomain)
      .values({ storeId, hostname: 'kuldeepsaini.com', isPrimary: true, status: 'active' })
    expect(await checkoutOf(storeId, 'checkout')).toBe('https://checkout.kuldeepsaini.com')
  })
  it('falls back to the platform origin when the store has no primary', async () => {
    const storeId = await seedStore('w')
    expect(await checkoutOf(storeId, 'checkout')).toBe('https://shop.platform.test')
  })
  it('stays same-origin when the subdomain is unset', async () => {
    const storeId = await seedStore('w')
    await owner
      .insert(storeDomain)
      .values({ storeId, hostname: 'brand.test', isPrimary: true, status: 'active' })
    expect(await checkoutOf(storeId, null)).toBe('https://brand.test')
  })
})
