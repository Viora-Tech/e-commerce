/** SOURCE OF TRUTH: www/apex twin redirect tests — WHAT: making a custom domain primary turns its twin into a redirect to it / WHY: a twin left serving showed a second copy of the store, and the fix was done by hand per store */
import { createDb, resolveHost, store, storeDomain, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDevDomainProvider, DEV_SSL_ISSUE_MS } from './dev-provider'
import { connectDomain, setPrimaryDomain, verifyDomain } from './service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const targets = { aRecord: '192.0.2.10', cnameTarget: 'shops.waimers.localhost' }
const opts = { platformRoots: ['localhost'], targets }
const provider = createDevDomainProvider()
const t0 = new Date('2026-09-23T10:00:00Z')

async function seedStore(slug: string) {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  await owner
    .insert(storeDomain)
    .values({ storeId: s.id, hostname: `${slug}.localhost`, isPrimary: true })
  return s.id
}

/** Connect each hostname on its own (no twin option), then bring it live with SSL. */
async function connectLive(storeId: string, hostname: string) {
  const [row] = await withStore(app, storeId, (tx) =>
    connectDomain(tx, storeId, { hostname }, opts),
  )
  const id = row?.id as string
  for (const now of [t0, new Date(t0.getTime() + DEV_SSL_ISSUE_MS)]) {
    await withStore(app, storeId, (tx) => verifyDomain(tx, id, { provider, targets, now }))
  }
  return id
}

describe('www/apex twin redirect', () => {
  it('making www primary sends its apex to it in one hop', async () => {
    const storeId = await seedStore('w')
    await connectLive(storeId, 'brand.test')
    const www = await connectLive(storeId, 'www.brand.test')
    expect(await resolveHost(app, 'brand.test')).toMatchObject({ redirect: false })

    await withStore(app, storeId, (tx) => setPrimaryDomain(tx, storeId, www))
    expect(await resolveHost(app, 'brand.test')).toMatchObject({
      primaryHostname: 'www.brand.test',
      redirect: true,
    })
  })

  it('and the other way round: an apex primary sends its www to it', async () => {
    const storeId = await seedStore('w')
    const apex = await connectLive(storeId, 'brand.test')
    await connectLive(storeId, 'www.brand.test')
    await withStore(app, storeId, (tx) => setPrimaryDomain(tx, storeId, apex))
    expect(await resolveHost(app, 'www.brand.test')).toMatchObject({
      primaryHostname: 'brand.test',
      redirect: true,
    })
  })

  it('leaves other custom domains alone', async () => {
    const storeId = await seedStore('w')
    await connectLive(storeId, 'shop.other.test')
    const www = await connectLive(storeId, 'www.brand.test')
    await withStore(app, storeId, (tx) => setPrimaryDomain(tx, storeId, www))
    expect(await resolveHost(app, 'shop.other.test')).toMatchObject({ redirect: false })
  })
})
