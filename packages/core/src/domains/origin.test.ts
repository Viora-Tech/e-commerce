/** SOURCE OF TRUTH: storefrontOriginFor tests — live primary domain wins, pending primary and no primary fall back, never another store's domain, localhost fallback kept in dev */
import { createDb, store, storeDomain, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { storefrontOrigin, storefrontOriginFor } from './origin'

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
