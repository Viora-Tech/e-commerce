import { createDb, media, productMedia, store, variant, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { MemoryStorageProvider } from '@commerce/storage/testing'
import { asc, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createProduct, updateProduct } from '../catalog/products'
import {
  checkStorageQuota,
  confirmUpload,
  createUploadIntent,
  deleteMedia,
  InvalidUpload,
  listMedia,
  markMediaFailed,
  markMediaProcessed,
  productGallery,
  setProductMedia,
  storageUsageBytes,
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

/** Simulates the browser's PUT: writes bytes at the key the ticket was signed for. */
async function putBytes(provider: MemoryStorageProvider, key: string, size = 1000) {
  await provider.put({ key, body: new Uint8Array(size), contentType: 'image/png' })
}

/** The key of the most (or nth-most) recent `presignUpload` call; throws rather than risk a silent `undefined` key in a test. */
function signedKey(provider: MemoryStorageProvider, index = -1): string {
  const signed = provider.signed.at(index)
  if (!signed) throw new Error(`no signed upload at index ${index}`)
  return signed.key
}

/**
 * A media row all the way through: signed, "uploaded" (bytes written to the
 * memory provider so `confirmUpload`'s HEAD check finds them), confirmed
 * (which for an image goes `processing`, not `ready`), then the worker's
 * pipeline outcome simulated with `markMediaProcessed` so it behaves like a
 * finished upload for tests that only care about the gallery/product side.
 */
async function readyUpload(storeId: string, provider: MemoryStorageProvider, filename = 'a.png') {
  return withStore(app, storeId, async (tx) => {
    const t = await createUploadIntent(tx, storeId, provider, { ...png, filename })
    await putBytes(provider, signedKey(provider))
    await confirmUpload(tx, t.mediaId, provider)
    await markMediaProcessed(tx, t.mediaId, {
      url: t.url,
      key: signedKey(provider),
      provider: provider.id,
      contentType: 'image/png',
      size: 1000,
      width: png.width,
      height: png.height,
      variants: null,
      thumbhash: 'AAAA',
    })
    return t.mediaId
  })
}

describe('createUploadIntent / confirmUpload', () => {
  it('signs a per-store key, stores a pending row, and confirm queues an image for processing', async () => {
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

    await putBytes(provider, signedKey(provider, 0))
    const confirmed = await withStore(app, storeId, (tx) =>
      confirmUpload(tx, ticket.mediaId, provider, { width: 1600 }),
    )
    // Images are handed to the pipeline, not made ready immediately.
    expect(confirmed.status).toBe('processing')
    expect(
      (await withStore(app, storeId, (tx) => listMedia(tx, { page: 1, perPage: 10 }))).total,
    ).toBe(0)

    await withStore(app, storeId, (tx) =>
      markMediaProcessed(tx, ticket.mediaId, {
        url: ticket.url,
        key: signedKey(provider, 0),
        provider: provider.id,
        contentType: 'image/png',
        size: 1000,
        width: 1600,
        height: 1200,
        variants: { '320': { avif: 'a', webp: 'w' } },
        thumbhash: 'AAAA',
      }),
    )
    const list = await withStore(app, storeId, (tx) => listMedia(tx, { page: 1, perPage: 10 }))
    expect(list.total).toBe(1)
    expect(list.items[0]).toMatchObject({ width: 1600, usedBy: 0 })
  })

  it('confirming a video goes straight to ready (no pipeline for mp4)', async () => {
    const storeId = await seedStore()
    const provider = new MemoryStorageProvider()
    const mp4 = { filename: 'clip.mp4', contentType: 'video/mp4', size: 2000 }
    const ticket = await withStore(app, storeId, (tx) =>
      createUploadIntent(tx, storeId, provider, mp4),
    )
    await provider.put({
      key: signedKey(provider, 0),
      body: new Uint8Array(2000),
      contentType: 'video/mp4',
    })
    const confirmed = await withStore(app, storeId, (tx) =>
      confirmUpload(tx, ticket.mediaId, provider),
    )
    expect(confirmed.status).toBe('ready')
  })

  it('confirm rejects (and deletes) an object whose real size exceeds the per-type limit', async () => {
    const storeId = await seedStore()
    const provider = new MemoryStorageProvider()
    const ticket = await withStore(app, storeId, (tx) =>
      createUploadIntent(tx, storeId, provider, png),
    )
    const key = signedKey(provider, 0)
    // The browser lied about size at presign time; the real object is over the 10 MB image limit.
    await provider.put({ key, body: new Uint8Array(11 * 1024 * 1024), contentType: 'image/png' })
    await expect(
      withStore(app, storeId, (tx) => confirmUpload(tx, ticket.mediaId, provider)),
    ).rejects.toBeInstanceOf(InvalidUpload)
    expect(await provider.get(key)).toBeNull()
  })

  it('confirm rejects when the object never arrived', async () => {
    const storeId = await seedStore()
    const provider = new MemoryStorageProvider()
    const ticket = await withStore(app, storeId, (tx) =>
      createUploadIntent(tx, storeId, provider, png),
    )
    await expect(
      withStore(app, storeId, (tx) => confirmUpload(tx, ticket.mediaId, provider)),
    ).rejects.toBeInstanceOf(InvalidUpload)
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
        createUploadIntent(tx, storeId, provider, { ...png, size: 11 * 1024 * 1024 }),
      ),
    ).rejects.toBeInstanceOf(InvalidUpload)
    expect(provider.signed).toHaveLength(0)
  })
})

describe('markMediaFailed', () => {
  it('marks a row failed and hides it from listMedia', async () => {
    const storeId = await seedStore()
    const provider = new MemoryStorageProvider()
    const ticket = await withStore(app, storeId, (tx) =>
      createUploadIntent(tx, storeId, provider, png),
    )
    await putBytes(provider, signedKey(provider, 0))
    await withStore(app, storeId, (tx) => confirmUpload(tx, ticket.mediaId, provider))
    await withStore(app, storeId, (tx) => markMediaFailed(tx, ticket.mediaId, 'decompression bomb'))
    const [row] = await withStore(app, storeId, (tx) => tx.select().from(media))
    expect(row).toMatchObject({ status: 'failed', processError: 'decompression bomb' })
  })
})

describe('storageUsageBytes / checkStorageQuota', () => {
  it('sums only ready media and reports ok under the default quota', async () => {
    const storeId = await seedStore()
    const provider = new MemoryStorageProvider()
    await readyUpload(storeId, provider, 'a.png')
    const used = await withStore(app, storeId, (tx) => storageUsageBytes(tx, storeId))
    expect(used).toBe(1000)
    const check = await withStore(app, storeId, (tx) => checkStorageQuota(tx, storeId))
    expect(check.ok).toBe(true)
    expect(check.usedBytes).toBe(1000)
  })

  it('reports over quota when a small explicit quota is passed', async () => {
    const storeId = await seedStore()
    const provider = new MemoryStorageProvider()
    await readyUpload(storeId, provider, 'a.png')
    const check = await withStore(app, storeId, (tx) => checkStorageQuota(tx, storeId, 100))
    expect(check.ok).toBe(false)
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

  it('seeds S3 from env only when every required variable is present, and prefers R2 when both are set', () => {
    expect(storageDefaultsFromEnv({ S3_BUCKET: 'b' }).enabled).toEqual([])
    const full = storageDefaultsFromEnv({
      S3_ACCESS_KEY_ID: 'ak',
      S3_SECRET_ACCESS_KEY: 'sk',
      S3_REGION: 'ap-south-1',
      S3_BUCKET: 'b',
    })
    expect(full.enabled).toEqual(['s3'])
    expect(full.providers.s3?.bucket).toBe('b')

    const both = storageDefaultsFromEnv({
      R2_ACCOUNT_ID: 'a',
      R2_ACCESS_KEY_ID: 'k',
      R2_SECRET_ACCESS_KEY: 's',
      R2_BUCKET: 'b',
      R2_PUBLIC_BASE_URL: 'https://pub.r2.dev',
      S3_ACCESS_KEY_ID: 'ak',
      S3_SECRET_ACCESS_KEY: 'sk',
      S3_REGION: 'ap-south-1',
      S3_BUCKET: 'b2',
    })
    expect(both.enabled).toEqual(['r2'])
  })
})
