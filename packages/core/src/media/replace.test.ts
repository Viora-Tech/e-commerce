/** SOURCE OF TRUTH: tests for "Replace photo from link" — WHAT the row keeps its id, gallery place and variant link while its file changes, and non-images or private hosts are refused / WHY the 480 px photo fix must never break which photo belongs to which colour */
import { createDb, media, productMedia, store, variant, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { MemoryStorageProvider } from '@commerce/storage/testing'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createProduct } from '../catalog/products'
import { BlockedUrlError } from '../net/safe-fetch'
import { replaceImageFromUrl } from './replace'
import { InvalidUpload } from './service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const publicLookup = async () => ['93.184.216.34']
const answer = (body: Uint8Array<ArrayBuffer>, contentType: string, status = 200) =>
  (async () =>
    new Response(body, { status, headers: { 'content-type': contentType } })) as typeof fetch

async function seed(provider: MemoryStorageProvider) {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'W' }).returning()
  if (!s) throw new Error('seed')
  const storeId = s.id
  await provider.put({ key: 'old.png', body: new Uint8Array(10), contentType: 'image/png' })
  return withStore(app, storeId, async (tx) => {
    const [m] = await tx
      .insert(media)
      .values({
        storeId,
        url: 'https://cdn.test/old.png',
        key: 'old.png',
        provider: provider.id,
        contentType: 'image/png',
        size: 10,
        width: 480,
        height: 480,
        alt: 'Black, top',
        variants: { '480': { avif: 'a', webp: 'w' } },
        status: 'ready',
      })
      .returning()
    if (!m) throw new Error('media')
    const productId = await createProduct(tx, storeId, {
      title: 'Mouse',
      status: 'active',
      tags: [],
      options: [],
      variants: [{ optionValues: [], pricePaise: 100, mediaId: m.id }],
      mediaIds: [m.id],
    })
    return { storeId, mediaId: m.id, productId }
  })
}

describe('replaceImageFromUrl', () => {
  it('swaps the file but keeps the row, its gallery place, variant link and alt', async () => {
    const provider = new MemoryStorageProvider()
    const { storeId, mediaId, productId } = await seed(provider)
    const bytes = new Uint8Array(2048)
    const out = await withStore(app, storeId, (tx) =>
      replaceImageFromUrl(
        tx,
        storeId,
        provider,
        { id: mediaId, url: 'https://cdn.shopify.com/s/files/1/X3_Top_M.png?v=1' },
        { fetch: answer(bytes, 'image/png'), lookup: publicLookup },
      ),
    )
    expect(out.id).toBe(mediaId)
    const [row] = await owner.select().from(media).where(eq(media.id, mediaId))
    expect(row?.status).toBe('processing')
    expect(row?.size).toBe(2048)
    expect(row?.alt).toBe('Black, top')
    expect(row?.key).not.toBe('old.png')
    expect(row?.variants).toEqual({ '480': { avif: 'a', webp: 'w' } })
    expect(await provider.head('old.png')).toBeNull()
    const gallery = await owner
      .select()
      .from(productMedia)
      .where(eq(productMedia.productId, productId))
    expect(gallery.map((g) => g.mediaId)).toEqual([mediaId])
    const [v] = await owner.select().from(variant).where(eq(variant.productId, productId))
    expect(v?.mediaId).toBe(mediaId)
  })

  it('refuses a link that is not an image and leaves the row alone', async () => {
    const provider = new MemoryStorageProvider()
    const { storeId, mediaId } = await seed(provider)
    await expect(
      withStore(app, storeId, (tx) =>
        replaceImageFromUrl(
          tx,
          storeId,
          provider,
          { id: mediaId, url: 'https://example.com/page' },
          { fetch: answer(new Uint8Array(5), 'text/html'), lookup: publicLookup },
        ),
      ),
    ).rejects.toBeInstanceOf(InvalidUpload)
    const [row] = await owner.select().from(media).where(eq(media.id, mediaId))
    expect(row?.key).toBe('old.png')
    expect(row?.status).toBe('ready')
  })

  it('refuses a link to a private address', async () => {
    const provider = new MemoryStorageProvider()
    const { storeId, mediaId } = await seed(provider)
    await expect(
      withStore(app, storeId, (tx) =>
        replaceImageFromUrl(
          tx,
          storeId,
          provider,
          { id: mediaId, url: 'https://internal.test/x.png' },
          { fetch: answer(new Uint8Array(5), 'image/png'), lookup: async () => ['10.0.0.5'] },
        ),
      ),
    ).rejects.toBeInstanceOf(BlockedUrlError)
  })
})
