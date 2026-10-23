/** SOURCE OF TRUTH: Files library file page tests — WHAT getMedia, mediaNeighbours and mediaUsedIn / WHY the file page must stay store-scoped and in list order */
import { createDb, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { MemoryStorageProvider } from '@commerce/storage/testing'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createProduct } from '../catalog/products'
import { getMedia, mediaNeighbours, mediaUsedIn } from './library'
import { confirmUpload, createUploadIntent, deleteMedia, markMediaProcessed } from './service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seedStore(slug: string) {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  return s.id
}

/** A finished image upload: signed, written, confirmed and marked processed. */
async function readyUpload(storeId: string, provider: MemoryStorageProvider, filename: string) {
  return withStore(app, storeId, async (tx) => {
    const t = await createUploadIntent(tx, storeId, provider, {
      filename,
      contentType: 'image/png',
      size: 1000,
      width: 800,
      height: 600,
    })
    const key = provider.signed.at(-1)?.key
    if (!key) throw new Error('no signed upload')
    await provider.put({ key, body: new Uint8Array(1000), contentType: 'image/png' })
    await confirmUpload(tx, t.mediaId, provider)
    await markMediaProcessed(tx, t.mediaId, {
      url: t.url,
      key,
      provider: provider.id,
      contentType: 'image/png',
      size: 1000,
      width: 800,
      height: 600,
      variants: null,
      thumbhash: 'AAAA',
    })
    return t.mediaId
  })
}

function productWith(storeId: string, title: string, mediaIds: string[]) {
  return withStore(app, storeId, (tx) =>
    createProduct(tx, storeId, {
      title,
      status: 'active',
      tags: [],
      options: [],
      variants: [{ optionValues: [], pricePaise: 100 }],
      mediaIds,
    }),
  )
}

describe('mediaUsedIn', () => {
  it('lists the products whose gallery holds the file, by title', async () => {
    const storeId = await seedStore('w')
    const provider = new MemoryStorageProvider()
    const a = await readyUpload(storeId, provider, 'a.png')
    const b = await readyUpload(storeId, provider, 'b.png')
    const pad = await productWith(storeId, 'Pad', [a, b])
    const desk = await productWith(storeId, 'Desk mat', [a])
    await productWith(storeId, 'Lamp', [b])

    const used = await withStore(app, storeId, (tx) => mediaUsedIn(tx, a))
    expect(used).toEqual([
      { productId: desk, title: 'Desk mat' },
      { productId: pad, title: 'Pad' },
    ])

    const unused = await readyUpload(storeId, provider, 'c.png')
    expect(await withStore(app, storeId, (tx) => mediaUsedIn(tx, unused))).toEqual([])

    await withStore(app, storeId, (tx) => deleteMedia(tx, a, provider))
    expect(await withStore(app, storeId, (tx) => mediaUsedIn(tx, a))).toEqual([])
  })

  it("does not show another store's products", async () => {
    const storeA = await seedStore('a')
    const storeB = await seedStore('b')
    const provider = new MemoryStorageProvider()
    const a = await readyUpload(storeA, provider, 'a.png')
    await productWith(storeA, 'Pad', [a])

    expect(await withStore(app, storeB, (tx) => mediaUsedIn(tx, a))).toEqual([])
    expect(await withStore(app, storeA, (tx) => mediaUsedIn(tx, a))).toHaveLength(1)
  })
})

describe('getMedia', () => {
  it('returns the list columns plus status for its own store, null elsewhere or when missing', async () => {
    const storeA = await seedStore('a')
    const storeB = await seedStore('b')
    const provider = new MemoryStorageProvider()
    const a = await readyUpload(storeA, provider, 'Front.png')
    await productWith(storeA, 'Pad', [a])

    const row = await withStore(app, storeA, (tx) => getMedia(tx, a))
    expect(row).toMatchObject({
      id: a,
      contentType: 'image/png',
      size: 1000,
      width: 800,
      height: 600,
      status: 'ready',
      usedBy: 1,
    })
    expect(await withStore(app, storeB, (tx) => getMedia(tx, a))).toBeNull()
    expect(
      await withStore(app, storeA, (tx) => getMedia(tx, '01a16498-0000-7000-8000-000000000000')),
    ).toBeNull()
  })
})

describe('mediaNeighbours', () => {
  it('steps through the library newest first, within the search', async () => {
    const storeId = await seedStore('w')
    const provider = new MemoryStorageProvider()
    const oldest = await readyUpload(storeId, provider, 'pad-1.png')
    const other = await readyUpload(storeId, provider, 'lamp.png')
    const newest = await readyUpload(storeId, provider, 'pad-2.png')

    const around = (id: string, search?: string) =>
      withStore(app, storeId, (tx) => mediaNeighbours(tx, id, { search }))
    expect(await around(other)).toEqual({ previous: newest, next: oldest })
    expect(await around(newest)).toEqual({ previous: null, next: other })
    expect(await around(oldest)).toEqual({ previous: other, next: null })
    expect(await around(newest, 'pad')).toEqual({ previous: null, next: oldest })
  })
})
