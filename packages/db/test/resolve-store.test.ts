import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb } from '../src/client'
import { resolveStore } from '../src/resolve-store'
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
})
