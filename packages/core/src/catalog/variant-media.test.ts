/** SOURCE OF TRUTH: variant images tests — WHAT: the ordered variant_media list and variant.media_id stay in step through product saves, imports, gallery edits, setVariantMedia, media deletes and the Liquid product data / WHY: single-image readers (carts, orders, feeds) and the list readers (product page, themes) must never disagree */
import {
  createDb,
  media,
  productMedia,
  store,
  variant,
  variantMedia,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { MemoryStorageProvider } from '@commerce/storage'
import { asc, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { deleteMedia } from '../media/service'
import { loadProducts } from '../theme-import/product-data'
import { createProduct, updateProduct } from './products'
import type { ProductWrite } from './schemas'
import { loadVariantMedia, nextVariantMedia, setVariantMedia } from './variant-media'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seedStore(slug = 'w') {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  return s.id
}

async function seedMedia(storeId: string, n: number): Promise<string[]> {
  const rows = await owner
    .insert(media)
    .values(
      Array.from({ length: n }, (_, i) => ({
        storeId,
        url: `https://cdn.test/${storeId}/${i}.jpg`,
        contentType: 'image/jpeg',
      })),
    )
    .returning({ id: media.id })
  return rows.map((r) => r.id)
}

const baseWrite = (mediaIds: string[], blackImages?: string[], blackMain?: string | null) =>
  ({
    title: 'Glasspad',
    status: 'active',
    mediaIds,
    options: [{ name: 'Colour', values: [{ value: 'Black' }, { value: 'White' }] }],
    variants: [
      {
        optionValues: ['Black'],
        pricePaise: 1000,
        ...(blackImages === undefined ? {} : { mediaIds: blackImages }),
        ...(blackMain === undefined ? {} : { mediaId: blackMain }),
      },
      { optionValues: ['White'], pricePaise: 1000 },
    ],
  }) satisfies ProductWrite

async function state(storeId: string, productId: string) {
  return withStore(app, storeId, async (tx) => {
    const vs = await tx
      .select({ id: variant.id, title: variant.title, mediaId: variant.mediaId })
      .from(variant)
      .where(eq(variant.productId, productId))
      .orderBy(asc(variant.position))
    const lists = await loadVariantMedia(
      tx,
      vs.map((v) => v.id),
    )
    const gallery = await tx
      .select({ mediaId: productMedia.mediaId })
      .from(productMedia)
      .where(eq(productMedia.productId, productId))
      .orderBy(asc(productMedia.position))
    const black = vs.find((v) => v.title === 'Black')
    const white = vs.find((v) => v.title === 'White')
    if (!black || !white) throw new Error('variants')
    return {
      black: { ...black, list: lists.get(black.id) ?? [] },
      white: { ...white, list: lists.get(white.id) ?? [] },
      gallery: gallery.map((g) => g.mediaId),
    }
  })
}

describe('nextVariantMedia', () => {
  it('takes the ordered list when sent, deduplicated', () => {
    expect(nextVariantMedia({ mediaIds: ['b', 'a', 'b'] }, ['x'])).toEqual(['b', 'a'])
  })
  it('puts a lone main image first and keeps the rest', () => {
    expect(nextVariantMedia({ mediaId: 'b' }, ['a', 'b', 'c'])).toEqual(['b', 'a', 'c'])
  })
  it('clears when no image is sent', () => {
    expect(nextVariantMedia({ mediaId: null }, ['a'])).toEqual([])
    expect(nextVariantMedia({}, ['a'])).toEqual([])
  })
})

describe('variant images through the product save', () => {
  it('assigns several images in order and keeps the main image in variant.media_id', async () => {
    const storeId = await seedStore()
    const [a, b, c] = (await seedMedia(storeId, 3)) as [string, string, string]
    const id = await withStore(app, storeId, (tx) =>
      createProduct(tx, storeId, baseWrite([a, b, c], [c, a])),
    )
    const s = await state(storeId, id)
    expect(s.black.list).toEqual([c, a])
    expect(s.black.mediaId).toBe(c)
    expect(s.white.list).toEqual([])
    expect(s.white.mediaId).toBeNull()
  })

  it('reorders and removes, keeping the main image in step', async () => {
    const storeId = await seedStore()
    const [a, b, c] = (await seedMedia(storeId, 3)) as [string, string, string]
    const id = await withStore(app, storeId, (tx) =>
      createProduct(tx, storeId, baseWrite([a, b, c], [a, b, c])),
    )
    await withStore(app, storeId, (tx) =>
      updateProduct(tx, storeId, id, baseWrite([a, b, c], [c, b])),
    )
    let s = await state(storeId, id)
    expect(s.black.list).toEqual([c, b])
    expect(s.black.mediaId).toBe(c)
    await withStore(app, storeId, (tx) => updateProduct(tx, storeId, id, baseWrite([a, b, c], [])))
    s = await state(storeId, id)
    expect(s.black.list).toEqual([])
    expect(s.black.mediaId).toBeNull()
  })

  it('maps an import that only knows the main image (Shopify image_id) onto the list', async () => {
    const storeId = await seedStore()
    const [a, b, c] = (await seedMedia(storeId, 3)) as [string, string, string]
    const id = await withStore(app, storeId, (tx) =>
      createProduct(tx, storeId, baseWrite([a, b, c], undefined, b), { imported: true }),
    )
    let s = await state(storeId, id)
    expect(s.black.list).toEqual([b])
    expect(s.black.mediaId).toBe(b)
    // The merchant adds more images, then a re-import names a different main image.
    await withStore(app, storeId, (tx) =>
      updateProduct(tx, storeId, id, baseWrite([a, b, c], [b, c])),
    )
    await withStore(app, storeId, (tx) =>
      updateProduct(tx, storeId, id, baseWrite([a, b, c], undefined, a), { imported: true }),
    )
    s = await state(storeId, id)
    expect(s.black.list).toEqual([a, b, c])
    expect(s.black.mediaId).toBe(a)
  })

  it('drops variant images that leave the gallery and moves the main image on', async () => {
    const storeId = await seedStore()
    const [a, b, c] = (await seedMedia(storeId, 3)) as [string, string, string]
    const id = await withStore(app, storeId, (tx) =>
      createProduct(tx, storeId, baseWrite([a, b, c], [a, c])),
    )
    await withStore(app, storeId, (tx) => updateProduct(tx, storeId, id, baseWrite([b, c], [a, c])))
    const s = await state(storeId, id)
    expect(s.black.list).toEqual([c])
    expect(s.black.mediaId).toBe(c)
  })

  it('ignores another store’s media ids', async () => {
    const storeId = await seedStore()
    const other = await seedStore('o')
    const [a] = (await seedMedia(storeId, 1)) as [string]
    const [foreign] = (await seedMedia(other, 1)) as [string]
    const id = await withStore(app, storeId, (tx) =>
      createProduct(tx, storeId, baseWrite([a], [foreign, a])),
    )
    const s = await state(storeId, id)
    expect(s.black.list).toEqual([a])
    expect(s.black.mediaId).toBe(a)
  })
})

describe('setVariantMedia', () => {
  it('sets the list, adds new files to the gallery end and syncs the main image', async () => {
    const storeId = await seedStore()
    const [a, b, uploaded] = (await seedMedia(storeId, 3)) as [string, string, string]
    const id = await withStore(app, storeId, (tx) => createProduct(tx, storeId, baseWrite([a, b])))
    const before = await state(storeId, id)
    const out = await withStore(app, storeId, (tx) =>
      setVariantMedia(tx, storeId, before.black.id, [uploaded, b, uploaded]),
    )
    expect(out.mediaIds).toEqual([uploaded, b])
    const s = await state(storeId, id)
    expect(s.black.list).toEqual([uploaded, b])
    expect(s.black.mediaId).toBe(uploaded)
    expect(s.gallery).toEqual([a, b, uploaded])
  })

  it('refuses media it cannot see and an unknown variant', async () => {
    const storeId = await seedStore()
    const other = await seedStore('o')
    const [a] = (await seedMedia(storeId, 1)) as [string]
    const [foreign] = (await seedMedia(other, 1)) as [string]
    const id = await withStore(app, storeId, (tx) => createProduct(tx, storeId, baseWrite([a])))
    const s = await state(storeId, id)
    await expect(
      withStore(app, storeId, (tx) => setVariantMedia(tx, storeId, s.black.id, [foreign])),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      withStore(app, storeId, (tx) => setVariantMedia(tx, storeId, foreign, [a])),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('clears with an empty list', async () => {
    const storeId = await seedStore()
    const [a] = (await seedMedia(storeId, 1)) as [string]
    const id = await withStore(app, storeId, (tx) =>
      createProduct(tx, storeId, baseWrite([a], [a])),
    )
    const s0 = await state(storeId, id)
    await withStore(app, storeId, (tx) => setVariantMedia(tx, storeId, s0.black.id, []))
    const s = await state(storeId, id)
    expect(s.black.list).toEqual([])
    expect(s.black.mediaId).toBeNull()
    expect(s.gallery).toEqual([a])
  })
})

describe('deleting a file a variant uses', () => {
  it('falls back to the variant’s next image', async () => {
    const storeId = await seedStore()
    const [a, b] = (await seedMedia(storeId, 2)) as [string, string]
    const id = await withStore(app, storeId, (tx) =>
      createProduct(tx, storeId, baseWrite([a, b], [a, b])),
    )
    await withStore(app, storeId, (tx) => deleteMedia(tx, a, new MemoryStorageProvider()))
    const s = await state(storeId, id)
    expect(s.black.list).toEqual([b])
    expect(s.black.mediaId).toBe(b)
    const rows = await owner.select().from(variantMedia).where(eq(variantMedia.mediaId, a))
    expect(rows).toEqual([])
  })
})

describe('Liquid product data', () => {
  it('gives a variant its images with the gallery media ids and option-value alt text', async () => {
    const storeId = await seedStore()
    const [a, b, c] = (await seedMedia(storeId, 3)) as [string, string, string]
    const id = await withStore(app, storeId, (tx) =>
      createProduct(tx, storeId, baseWrite([a, b, c], [c, b])),
    )
    const [p] = await withStore(app, storeId, (tx) => loadProducts(tx, [id]))
    const black = p?.variants.find((v) => v.title === 'Black')
    const white = p?.variants.find((v) => v.title === 'White')
    expect(black?.image?.id).toBe(c)
    expect(black?.media?.map((m) => m.id)).toEqual([c, b])
    expect(white?.media).toEqual([])
    // Images with no alt of their own read as the option value their variant has.
    expect(p?.images.find((i) => i.id === c)?.alt).toBe('Black')
    expect(p?.images.find((i) => i.id === a)?.alt).toBe('Glasspad')
  })
})
