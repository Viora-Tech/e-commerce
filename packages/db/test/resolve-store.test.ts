import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb } from '../src/client'
import { resolveHost, resolveStore, storesWithPendingDomains } from '../src/resolve-store'
import { store, storeDomain } from '../src/schema'
import { withStore } from '../src/with-store'
import { resetDb } from './reset'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seed() {
  const [a, b] = await owner
    .insert(store)
    .values([
      { slug: 'a', name: 'A' },
      { slug: 'b', name: 'B' },
    ])
    .returning()
  if (!a || !b) throw new Error('seed')
  await owner.insert(storeDomain).values([
    { storeId: a.id, hostname: 'a.example.com', isPrimary: true },
    { storeId: a.id, hostname: 'localhost' },
    { storeId: b.id, hostname: 'b.example.com', isPrimary: true },
  ])
  return { a, b }
}

describe('resolveStore', () => {
  it('maps a hostname to its store using the app role, with no store context', async () => {
    const { a, b } = await seed()
    expect(await resolveStore(app, 'a.example.com')).toBe(a.id)
    expect(await resolveStore(app, 'localhost')).toBe(a.id)
    expect(await resolveStore(app, 'b.example.com')).toBe(b.id)
  })

  it('is case-insensitive on the hostname', async () => {
    const { a } = await seed()
    expect(await resolveStore(app, 'A.Example.COM')).toBe(a.id)
  })

  it('returns null for an unknown hostname', async () => {
    await seed()
    expect(await resolveStore(app, 'nobody.example.com')).toBeNull()
  })

  it('store_domain itself stays RLS-protected: a store sees only its own domains', async () => {
    const { a } = await seed()
    const rows = await withStore(app, a.id, (tx) => tx.select().from(storeDomain))
    expect(rows.map((r) => r.hostname).sort()).toEqual(['a.example.com', 'localhost'])
    expect(await app.select().from(storeDomain)).toEqual([])
  })

  it('does not resolve a custom domain until it is verified', async () => {
    const { a } = await seed()
    await owner.insert(storeDomain).values([
      { storeId: a.id, hostname: 'pending.test', kind: 'custom', status: 'pending' },
      { storeId: a.id, hostname: 'failed.test', kind: 'custom', status: 'failed' },
    ])
    expect(await resolveStore(app, 'pending.test')).toBeNull()
    expect(await resolveStore(app, 'failed.test')).toBeNull()
    expect(await resolveHost(app, 'pending.test')).toBeNull()
  })
})

describe('resolveHost', () => {
  it('returns the store, its primary hostname and whether this host redirects', async () => {
    const { a } = await seed()
    await owner
      .insert(storeDomain)
      .values([{ storeId: a.id, hostname: 'www.a.test', kind: 'custom', redirectToPrimary: true }])
    expect(await resolveHost(app, 'WWW.A.TEST')).toEqual({
      storeId: a.id,
      primaryHostname: 'a.example.com',
      redirect: true,
    })
    expect(await resolveHost(app, 'localhost')).toEqual({
      storeId: a.id,
      primaryHostname: 'a.example.com',
      redirect: false,
    })
  })

  it('never redirects the primary itself, even with the flag set', async () => {
    const { a } = await seed()
    await owner.update(storeDomain).set({ redirectToPrimary: true })
    expect(await resolveHost(app, 'a.example.com')).toEqual({
      storeId: a.id,
      primaryHostname: 'a.example.com',
      redirect: false,
    })
  })

  it('reports no primary when the store has none live', async () => {
    const { b } = await seed()
    await owner.update(storeDomain).set({ isPrimary: false })
    expect(await resolveHost(app, 'b.example.com')).toEqual({
      storeId: b.id,
      primaryHostname: null,
      redirect: false,
    })
    expect(await resolveHost(app, 'nobody.test')).toBeNull()
  })
})

describe('storesWithPendingDomains', () => {
  it('lists stores with custom domains awaiting DNS or a certificate, once each', async () => {
    const { a, b } = await seed()
    await owner.insert(storeDomain).values([
      { storeId: a.id, hostname: 'one.test', kind: 'custom', status: 'pending' },
      { storeId: a.id, hostname: 'two.test', kind: 'custom', status: 'pending' },
      { storeId: b.id, hostname: 'ssl.test', kind: 'custom', sslStatus: 'issuing' },
    ])
    expect((await storesWithPendingDomains(app)).sort()).toEqual([a.id, b.id].sort())
  })

  it('ignores platform domains, failed ones and live ones with certificates', async () => {
    const { a } = await seed()
    await owner.insert(storeDomain).values([
      { storeId: a.id, hostname: 'failed.test', kind: 'custom', status: 'failed' },
      { storeId: a.id, hostname: 'live.test', kind: 'custom' },
    ])
    expect(await storesWithPendingDomains(app)).toEqual([])
  })
})
