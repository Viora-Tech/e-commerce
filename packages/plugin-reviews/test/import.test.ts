import { media, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { MemoryStorageProvider } from '@commerce/storage/testing'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { importJudgemeReviews, parseJudgemeCsv, previewJudgemeImport } from '../src/judgeme'
import { copyReviewPhotos } from '../src/photos'
import { getReview, listReviews, ratingSummaries, reviewStats } from '../src/reviews'
import { review, reviewMedia } from '../src/schema'
import { defaultReviewsSettings } from '../src/settings'
import { storeReviewFeed } from '../src/storefront'
import { addProduct, app, owner, seedStore } from './helpers'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const HEADER =
  'title,body,rating,review_date,source,curated,reviewer_name,reviewer_email,product_id,product_handle,product_sku,reply,picture_urls'

const CSV = [
  HEADER,
  'Smooth and fast,"Glide is unreal, edges polished",5,2025-03-01 10:00:00 UTC,web,ok,Aarav M.,aarav@x.co,1,veil,VEIL-1,"Thanks, Aarav!",https://judgeme.imgix.net/a.jpg',
  'Great build,Sturdy,4,2025-03-02,web,ok,Priya S.,priya@x.co,2,coiled-cable-old,CABLE-9,,',
  'Nice texture,Soft,4,2025-03-03,web,ok,Meera D.,meera@x.co,3,zephyr,,,',
  'Spam,Buy now,1,2025-03-04,web,spam,Bot,bot@x.co,1,veil,,,',
  'No rating,Hmm,,2025-03-05,web,ok,X,x@x.co,1,veil,,,',
].join('\n')

describe('parseJudgemeCsv', () => {
  it('reads the export, skipping rows without a rating', () => {
    const r = parseJudgemeCsv(CSV)
    expect(r.ok && r.rows.length).toBe(4)
    expect(r.ok && r.skipped).toBe(1)
    const first = r.ok ? r.rows[0] : undefined
    expect(first).toMatchObject({
      rating: 5,
      handle: 'veil',
      sku: 'VEIL-1',
      reply: 'Thanks, Aarav!',
      pictures: ['https://judgeme.imgix.net/a.jpg'],
    })
    expect(first?.externalId).toMatch(/^fp:/)
    expect(r.ok && r.rows[3]?.curation).toBe('hidden')
  })

  it('refuses a file that is not a Judge.me export', () => {
    expect(parseJudgemeCsv('a,b\n1,2')).toEqual({ ok: false, error: 'not_judgeme' })
    expect(parseJudgemeCsv('   ')).toEqual({ ok: false, error: 'empty' })
  })

  it('keeps only http(s) photo addresses', () => {
    const r = parseJudgemeCsv(
      `${HEADER}\nT,B,5,2025-01-01,web,ok,A,a@x.co,1,veil,,,"file:///etc/passwd javascript:alert(1) https://ok.example/p.png"`,
    )
    expect(r.ok && r.rows[0]?.pictures).toEqual(['https://ok.example/p.png'])
  })
})

describe('Judge.me import', () => {
  it('matches by SKU, then handle; imports once; keeps ratings right', async () => {
    const storeId = await seedStore()
    const veil = await addProduct(storeId, 'veil', { sku: 'VEIL-1' })
    // Renamed since: the SKU still finds it.
    const cable = await addProduct(storeId, 'wraith-coiled-cable', { sku: 'CABLE-9' })
    const preview = await withStore(app, storeId, (tx) => previewJudgemeImport(tx, CSV))
    expect(preview).toMatchObject({ ok: true, ready: 3, noMatch: 1, already: 0, photos: 1 })
    expect(preview.ok && preview.rows.map((r) => r.result)).toEqual([
      'sku',
      'sku',
      'none',
      'handle',
    ])

    const opts = { copyPhotos: true, publish: true }
    const first = await withStore(app, storeId, (tx) =>
      importJudgemeReviews(tx, storeId, CSV, opts),
    )
    expect(first).toMatchObject({ ok: true, imported: 3, noMatch: 1, photosToCopy: 1 })
    const again = await withStore(app, storeId, (tx) =>
      importJudgemeReviews(tx, storeId, CSV, opts),
    )
    expect(again).toMatchObject({ ok: true, imported: 0, alreadyHere: 3 })

    const rows = await owner.select().from(review)
    expect(rows).toHaveLength(3)
    const spam = rows.find((r) => r.title === 'Spam')
    expect(spam?.status).toBe('hidden')
    const aarav = rows.find((r) => r.title === 'Smooth and fast')
    expect(aarav).toMatchObject({
      source: 'judgeme',
      reply: 'Thanks, Aarav!',
      productId: veil.productId,
    })
    expect(aarav?.createdAt.toISOString().slice(0, 10)).toBe('2025-03-01')
    const summaries = await withStore(app, storeId, (tx) =>
      ratingSummaries(tx, [veil.productId, cable.productId]),
    )
    expect(summaries.get(veil.productId)).toMatchObject({ rating: 5, count: 1 })
    expect(summaries.get(cable.productId)).toMatchObject({ rating: 4, count: 1 })
    const preview2 = await withStore(app, storeId, (tx) => previewJudgemeImport(tx, CSV))
    expect(preview2).toMatchObject({ ready: 0, already: 3 })
  })

  it('copies photos through the SSRF guard, and refuses private addresses', async () => {
    const storeId = await seedStore()
    await addProduct(storeId, 'veil', { sku: 'VEIL-1' })
    const csv = [
      HEADER,
      'Pic,Body,5,2025-01-01,web,ok,A,a@x.co,1,veil,,,"https://cdn.example/a.jpg https://inside.example/b.jpg"',
    ].join('\n')
    await withStore(app, storeId, (tx) =>
      importJudgemeReviews(tx, storeId, csv, { copyPhotos: true, publish: true }),
    )
    const storage = new MemoryStorageProvider()
    const fetched: string[] = []
    const fakeFetch = (async (url: string) => {
      fetched.push(String(url))
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      })
    }) as unknown as typeof fetch
    const processed: string[] = []
    const result = await copyReviewPhotos(
      {
        storeId,
        inStore: (fn) => withStore(app, storeId, fn),
        storage: async () => storage,
        log: () => {},
        processMedia: async (id) => {
          processed.push(id)
        },
      },
      {
        fetch: fakeFetch,
        lookup: async (host) => (host === 'inside.example' ? ['10.0.0.5'] : ['93.184.216.34']),
      },
    )
    expect(result).toEqual({ copied: 1, failed: 1 })
    expect(fetched).toEqual(['https://cdn.example/a.jpg'])
    const photos = await owner.select().from(reviewMedia)
    const copied = photos.find((p) => p.sourceUrl?.includes('cdn.example'))
    const refused = photos.find((p) => p.sourceUrl?.includes('inside.example'))
    expect(copied?.mediaId).toBeTruthy()
    expect(refused?.copyError).toMatch(/public address/)
    expect(processed).toEqual([copied?.mediaId])
    const [m] = await owner
      .select()
      .from(media)
      .where(eq(media.id, copied?.mediaId as string))
    expect(m?.status).toBe('processing')
    // Nothing left: a second run fetches nothing.
    const rerun = await copyReviewPhotos(
      {
        storeId,
        inStore: (fn) => withStore(app, storeId, fn),
        storage: async () => storage,
        log: () => {},
      },
      { fetch: fakeFetch },
    )
    expect(rerun).toEqual({ copied: 0, failed: 0 })
    expect((await withStore(app, storeId, (tx) => reviewStats(tx))).withPhotos).toBe(1)
  })

  it('imports store reviews, missing-product rows as store reviews when asked, and Shopify ids', async () => {
    const storeId = await seedStore()
    const renamed = await addProduct(storeId, 'veil-v2')
    await owner.execute(
      sql`insert into shopify_import_mapping (id, store_id, resource, source_id, local_id)
        values (gen_random_uuid(), ${storeId}, 'products', 'gid://shopify/Product/7001', ${renamed.productId})`,
    )
    const csv = [
      HEADER,
      'Old handle,Body,5,2025-01-01,web,ok,A,a@x.co,7001,veil,,,',
      'Great shop,Fast delivery,5,2025-01-02,web,ok,B,b@x.co,,,,,',
      'Waiting,Body,4,2025-01-03,web,not-yet,C,c@x.co,,,,,',
      'Gone product,Body,3,2025-01-04,web,ok,D,d@x.co,9,gone,,,',
    ].join('\n')
    const preview = await withStore(app, storeId, (tx) => previewJudgemeImport(tx, csv))
    expect(preview).toMatchObject({
      ok: true,
      ready: 1,
      store: 2,
      noMatch: 1,
      unmatched: [{ product: 'gone', reviews: 1 }],
    })
    const opts = { copyPhotos: false, publish: true }
    const first = await withStore(app, storeId, (tx) =>
      importJudgemeReviews(tx, storeId, csv, opts),
    )
    expect(first).toMatchObject({ ok: true, imported: 3, storeReviews: 2, noMatch: 1 })
    const second = await withStore(app, storeId, (tx) =>
      importJudgemeReviews(tx, storeId, csv, { ...opts, unmatchedAsStore: true }),
    )
    expect(second).toMatchObject({ ok: true, imported: 1, storeReviews: 1, alreadyHere: 3 })
    const third = await withStore(app, storeId, (tx) =>
      importJudgemeReviews(tx, storeId, csv, { ...opts, unmatchedAsStore: true }),
    )
    expect(third).toMatchObject({ imported: 0, alreadyHere: 4 })

    const rows = await owner.select().from(review)
    expect(rows.find((r) => r.title === 'Old handle')?.productId).toBe(renamed.productId)
    expect(rows.find((r) => r.title === 'Great shop')).toMatchObject({
      productId: null,
      status: 'published',
    })
    expect(rows.find((r) => r.title === 'Waiting')?.status).toBe('pending')
    expect(rows.find((r) => r.title === 'Gone product')?.productId).toBeNull()

    // The admin list, the detail page and the theme's review wall all carry store reviews.
    const list = await withStore(app, storeId, (tx) => listReviews(tx, { page: 1, perPage: 20 }))
    expect(list.total).toBe(4)
    expect(list.rows.filter((r) => r.productTitle === null)).toHaveLength(3)
    const shop = rows.find((r) => r.title === 'Great shop')
    const detail = await withStore(app, storeId, (tx) => getReview(tx, shop?.id as string))
    expect(detail?.product).toBeNull()
    const feed = await withStore(app, storeId, (tx) => storeReviewFeed(tx, defaultReviewsSettings))
    expect(feed.map((r) => r.title).sort()).toEqual(['Gone product', 'Great shop', 'Old handle'])
  })
})
