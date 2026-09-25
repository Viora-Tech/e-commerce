import { createDb, media, productMedia, store, variant, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { MemoryStorageProvider } from '@commerce/storage/testing'
import { asc, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createProduct, updateProduct } from '../catalog/products'
import {
  confirmUpload,
  createUploadIntent,
  deleteMedia,
  InvalidUpload,
  listMedia,
  productGallery,
  setProductMedia,
} from './service'
import { builtInStorageRegistry, resolveStorageProvider, storageDefaultsFromEnv } from './settings'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seedStore() {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'W' }).returning()
  if (!s) throw new Error('seed')
  return s.id
}

const png = { filename: 'Front.png', contentType: 'image/png', size: 1000, width: 800, height: 600 }

async function readyUpload(storeId: string, provider: MemoryStorageProvider, filename = 'a.png') {
  return withStore(app, storeId, async (tx) => {
    const t = await createUploadIntent(tx, storeId, provider, { ...png, filename })
    await confirmUpload(tx, t.mediaId)
    return t.mediaId
  })
}

describe('createUploadIntent / confirmUpload', () => {
  it('signs a per-store key, stores a pending row, and confirm makes it ready', async () => {
    const storeId = await seedStore()
    const provider = new MemoryStorageProvider()
    const ticket = await withStore(app, storeId, (tx) =>
      createUploadIntent(tx, storeId, provider, png),
    )
    expect(ticket.upload.method).toBe('PUT')
    expect(provider.signed[0]?.key).toMatch(new RegExp(`^stores/${storeId}/media/.*-front\\.png$`))
    expect(ticket.url).toBe(`https://media.test/${provider.signed[0]?.key}`)
    const before = await withStore(app, storeId, (tx) => tx.select().from(media))
    expect(before[0]).toMatchObject({ status: 'pending', provider: 'memory', width: 800 })
    expect(
      (await withStore(app, storeId, (tx) => listMedia(tx, { page: 1, perPage: 10 }))).total,
    ).toBe(0)
    await withStore(app, storeId, (tx) => confirmUpload(tx, ticket.mediaId, { width: 1600 }))
    const list = await withStore(app, storeId, (tx) => listMedia(tx, { page: 1, perPage: 10 }))
    expect(list.total).toBe(1)
    expect(list.items[0]).toMatchObject({ width: 1600, usedBy: 0 })
  })

  it('rejects disallowed types and oversized files before signing', async () => {
    const storeId = await seedStore()
    const provider = new MemoryStorageProvider()
    await expect(
      withStore(app, storeId, (tx) =>
        createUploadIntent(tx, storeId, provider, { ...png, contentType: 'application/pdf' }),
      ),
    ).rejects.toBeInstanceOf(InvalidUpload)
    await expect(
      withStore(app, storeId, (tx) =>
        createUploadIntent(tx, storeId, provider, { ...png, size: 30 * 1024 * 1024 }),
      ),
    ).rejects.toBeInstanceOf(InvalidUpload)
    expect(provider.signed).toHaveLength(0)
  })
})

describe('setProductMedia / deleteMedia', () => {
  it('orders the gallery, ignores unknown or pending ids, and clears stale variant thumbnails', async () => {
    const storeId = await seedStore()
    const provider = new MemoryStorageProvider()
    const a = await readyUpload(storeId, provider, 'a.png')
    const b = await readyUpload(storeId, provider, 'b.png')
    const pending = await withStore(app, storeId, async (tx) => {
      const t = await createUploadIntent(tx, storeId, provider, { ...png, filename: 'p.png' })
      return t.mediaId
    })
    const productId = await withStore(app, storeId, (tx) =>
      createProduct(tx, storeId, {
        title: 'Pad',
        status: 'active',
        tags: [],
        options: [],
        variants: [{ optionValues: [], pricePaise: 100, mediaId: b }],
        mediaIds: [b, a, pending, a],
      }),
    )
    let gallery = await withStore(app, storeId, (tx) => productGallery(tx, productId))
    expect(gallery.map((g) => g.id)).toEqual([b, a])
    const used = await withStore(app, storeId, (tx) => listMedia(tx, { page: 1, perPage: 10 }))
    expect(used.items.find((i) => i.id === a)?.usedBy).toBe(1)

    await withStore(app, storeId, (tx) => setProductMedia(tx, storeId, productId, [a]))
    gallery = await withStore(app, storeId, (tx) => productGallery(tx, productId))
    expect(gallery.map((g) => g.id)).toEqual([a])
    const [v] = await withStore(app, storeId, (tx) =>
      tx.select().from(variant).where(eq(variant.productId, productId)),
    )
    expect(v?.mediaId).toBeNull()

    await withStore(app, storeId, (tx) => deleteMedia(tx, a, provider))
    expect(provider.deleted).toHaveLength(1)
    const rows = await withStore(app, storeId, (tx) =>
      tx.select().from(productMedia).orderBy(asc(productMedia.position)),
    )
    expect(rows).toHaveLength(0)
    const list = await withStore(app, storeId, (tx) => listMedia(tx, { page: 1, perPage: 10 }))
    expect(list.items.map((i) => i.id)).toEqual([b])
  })

  it('updateProduct without mediaIds leaves the gallery alone', async () => {
    const storeId = await seedStore()
    const provider = new MemoryStorageProvider()
    const a = await readyUpload(storeId, provider)
    const base = {
      title: 'Pad',
      status: 'active' as const,
      tags: [],
      options: [],
      variants: [{ optionValues: [], pricePaise: 100 }],
    }
    const productId = await withStore(app, storeId, (tx) =>
      createProduct(tx, storeId, { ...base, mediaIds: [a] }),
    )
    await withStore(app, storeId, (tx) =>
      updateProduct(tx, storeId, productId, { ...base, title: 'Pad 2' }),
    )
    const gallery = await withStore(app, storeId, (tx) => productGallery(tx, productId))
    expect(gallery.map((g) => g.id)).toEqual([a])
  })
})

describe('storage settings', () => {
  it('falls back to the local folder when nothing is enabled or the enabled one is invalid', () => {
    const registry = builtInStorageRegistry()
    const none = resolveStorageProvider(
      registry,
      { enabled: [], providers: {}, migration: null },
      's',
    )
    expect(none.provider.id).toBe('local')
    const bad = resolveStorageProvider(
      registry,
      { enabled: ['r2'], providers: {}, migration: null },
      's',
    )
    expect(bad.provider.id).toBe('local')
    expect(bad.errors[0]).toContain('r2')
  })

  it('seeds R2 from env only when every variable is present', () => {
    expect(storageDefaultsFromEnv({ R2_BUCKET: 'b' }).enabled).toEqual([])
    const full = storageDefaultsFromEnv({
      R2_ACCOUNT_ID: 'a',
      R2_ACCESS_KEY_ID: 'k',
      R2_SECRET_ACCESS_KEY: 's',
      R2_BUCKET: 'b',
      R2_PUBLIC_BASE_URL: 'https://pub.r2.dev',
    })
    expect(full.enabled).toEqual(['r2'])
    expect(full.providers.r2?.bucket).toBe('b')
  })
})
