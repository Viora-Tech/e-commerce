import { describe, expect, it } from 'vitest'
import {
  countJudgemeRows,
  curationOf,
  importedStatus,
  type JudgemeRow,
  type MatchMaps,
  matchRow,
  parseJudgemeCsv,
  rowsToImport,
} from './judgeme'

/*
 * The pure half of the Judge.me import: reading the CSV, matching rows against lookups,
 * counting, choosing what to write. No database (test/import.test.ts covers that).
 */

// Judge.me's export, column for column.
const HEADER =
  'title,body,rating,review_date,source,curated,reviewer_name,reviewer_email,product_id,product_handle,reply,reply_date,picture_urls,ip_address,location,metaobject_handle,verified_buyer'

const rowsOf = (csv: string): JudgemeRow[] => {
  const r = parseJudgemeCsv(csv)
  if (!r.ok) throw new Error(r.error)
  return r.rows
}

const maps = (over: Partial<MatchMaps> = {}): MatchMaps => ({
  bySku: new Map(),
  byShopifyId: new Map(),
  byHandle: new Map(),
  existing: new Set(),
  ...over,
})

describe('parseJudgemeCsv', () => {
  it('reads every Judge.me column, ignoring IP address and location', () => {
    const [row] = rowsOf(
      [
        HEADER,
        'Love it,"Soft, sturdy",5,2025-03-01 10:00:00 UTC,web,ok,Aarav M.,Aarav@X.co,7001,Veil-Pad,"Thanks!",2025-03-02,https://judgeme.imgix.net/a.jpg,1.2.3.4,Mumbai,,true',
      ].join('\n'),
    )
    expect(row).toMatchObject({
      title: 'Love it',
      body: 'Soft, sturdy',
      rating: 5,
      name: 'Aarav M.',
      email: 'aarav@x.co',
      handle: 'veil-pad',
      shopifyProductId: '7001',
      reply: 'Thanks!',
      pictures: ['https://judgeme.imgix.net/a.jpg'],
      verified: true,
      curation: 'ok',
      store: false,
    })
    expect(row?.date?.toISOString()).toBe('2025-03-01T10:00:00.000Z')
    expect(row?.replyDate?.toISOString().slice(0, 10)).toBe('2025-03-02')
    expect(JSON.stringify(row)).not.toMatch(/1\.2\.3\.4|Mumbai/)
  })

  it('reads headers in any case, with spaces or dashes', () => {
    const [row] = rowsOf('Rating,Product Handle,Reviewer-Name,BODY\n4,veil,Priya,Nice')
    expect(row).toMatchObject({ rating: 4, handle: 'veil', name: 'Priya', body: 'Nice' })
  })

  it('takes a row with no product as a store review', () => {
    const [row] = rowsOf(
      `${HEADER}\nGreat shop,Fast delivery,5,2025-01-01,web,ok,A,a@x.co,,,,,,,,,`,
    )
    expect(row?.store).toBe(true)
  })

  it('reads a Shopify gid as the product id', () => {
    const [row] = rowsOf('rating,product_id\n5,gid://shopify/Product/42')
    expect(row).toMatchObject({ shopifyProductId: '42', store: false })
  })

  it('skips rows without a 1 to 5 rating, and blank lines silently', () => {
    const r = parseJudgemeCsv(
      `${HEADER}\nA,B,,2025-01-01,web,ok,X,,1,veil\n\nC,D,9,,web,ok,Y,,1,veil`,
    )
    expect(r).toMatchObject({ ok: true, rows: [], skipped: 2 })
  })

  it('gives the same row the same id on every read, and different rows different ids', () => {
    const csv = `${HEADER}\nT,B,5,2025-01-01,web,ok,A,a@x.co,1,veil\nT,B,5,2025-01-02,web,ok,A,a@x.co,1,veil`
    const [a, b] = rowsOf(csv)
    const [again] = rowsOf(csv)
    expect(a?.externalId).toMatch(/^fp:[0-9a-f]{32}$/)
    expect(again?.externalId).toBe(a?.externalId)
    expect(b?.externalId).not.toBe(a?.externalId)
  })

  it('uses a review id column when the export has one', () => {
    const [row] = rowsOf('id,rating,product_handle\n981,5,veil')
    expect(row?.externalId).toBe('judgeme:981')
  })

  it('refuses files that are not a review export', () => {
    expect(parseJudgemeCsv('a,b\n1,2')).toEqual({ ok: false, error: 'not_judgeme' })
    expect(parseJudgemeCsv('')).toEqual({ ok: false, error: 'empty' })
  })
})

describe('curation and status', () => {
  it("maps Judge.me's curated column", () => {
    expect(curationOf('ok')).toBe('ok')
    expect(curationOf('')).toBe('ok')
    expect(curationOf('spam')).toBe('hidden')
    expect(curationOf('Not yet')).toBe('pending')
    expect(curationOf('not-yet')).toBe('pending')
    expect(curationOf('unpublished')).toBe('hidden')
  })

  it('keeps hidden and pending reviews out of sight whatever the publish option', () => {
    expect(importedStatus('ok', true)).toBe('published')
    expect(importedStatus('ok', false)).toBe('pending')
    expect(importedStatus('pending', true)).toBe('pending')
    expect(importedStatus('hidden', true)).toBe('hidden')
  })
})

describe('matching, counting and choosing rows', () => {
  const rows = rowsOf(
    [
      'rating,product_handle,product_sku,product_id,picture_urls,title',
      '5,old-handle,SKU-1,,https://x.co/1.jpg,by sku',
      '5,renamed,,7001,,by id',
      '4,veil,,,https://x.co/2.jpg https://x.co/3.jpg,by handle',
      '5,,,,https://x.co/4.jpg,store',
      '3,gone,,,,missing',
      '2,gone,,,,missing again',
      '1,veil,,,,seen before',
    ].join('\n'),
  )
  const seen = rows[6]?.externalId ?? ''
  const m = maps({
    bySku: new Map([['SKU-1', 'p-sku']]),
    byShopifyId: new Map([['7001', 'p-id']]),
    byHandle: new Map([['veil', 'p-veil']]),
    existing: new Set([seen]),
  })
  const matches = rows.map((r) => matchRow(r, m))

  it('matches by SKU, then Shopify product id, then handle', () => {
    expect(matches.map((x) => x.result)).toEqual([
      'sku',
      'product_id',
      'handle',
      'store',
      'none',
      'none',
      'imported',
    ])
    expect(matches.slice(0, 4).map((x) => x.productId)).toEqual(['p-sku', 'p-id', 'p-veil', null])
  })

  it('counts new, store, missing and already imported rows, and names missing products', () => {
    expect(countJudgemeRows(rows, matches)).toEqual({
      total: 7,
      ready: 3,
      store: 1,
      noMatch: 2,
      already: 1,
      photos: 4,
      unmatched: [{ product: 'gone', reviews: 2 }],
    })
  })

  it('writes matched rows and store reviews, and missing-product rows only when asked', () => {
    const titles = (asStore: boolean) =>
      rowsToImport(rows, matches, asStore).map((t) => [t.row.title, t.productId])
    expect(titles(false)).toEqual([
      ['by sku', 'p-sku'],
      ['by id', 'p-id'],
      ['by handle', 'p-veil'],
      ['store', null],
    ])
    expect(titles(true).slice(4)).toEqual([
      ['missing', null],
      ['missing again', null],
    ])
  })
})
