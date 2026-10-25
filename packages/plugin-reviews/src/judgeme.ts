import { createHash } from 'node:crypto'
import { parseCsv } from '@commerce/core'
import { product, type StoreTx, variant } from '@commerce/db'
import { inArray, sql } from 'drizzle-orm'
import { type ReviewStatus, review, reviewMedia } from './schema'
import { MAX_REVIEW_PHOTOS } from './settings'

/*
 * Judge.me's review CSV (Judge.me → Settings → Data export → Export reviews). Column names
 * vary a little between export versions and are read case-insensitively, each field from
 * the first of its known names. A review is matched to one of our products by SKU first,
 * then by Judge.me's `product_id` (the Shopify product id, through the Shopify importer's
 * id map), then by the product handle (the importer keeps handles). A row with no product
 * at all is a store review (about the shop), imported without a product; rows whose
 * product is not here can come in as store reviews too, when the merchant asks.
 * Importing is idempotent: each row carries an external id (Judge.me's review id, or a
 * fingerprint of the row when the export has none), unique per store, and a row whose id
 * is already here is skipped. IP address and location are never read.
 */

/** The largest export we read in one go. */
export const JUDGEME_MAX_BYTES = 4 * 1024 * 1024
const JUDGEME_MAX_ROWS = 5000

const COLUMNS = {
  id: ['id', 'review_id', 'external_id'],
  title: ['title', 'review_title'],
  body: ['body', 'review_body', 'content', 'review'],
  rating: ['rating', 'stars'],
  date: ['review_date', 'created_at', 'date'],
  name: ['reviewer_name', 'name', 'author'],
  email: ['reviewer_email', 'email'],
  handle: ['product_handle', 'handle'],
  productId: ['product_id', 'shopify_product_id'],
  productTitle: ['product_title', 'product_name'],
  sku: ['product_sku', 'sku'],
  pictures: ['picture_urls', 'pictures', 'photo_urls', 'image_urls'],
  reply: ['reply', 'store_reply', 'shop_reply'],
  replyDate: ['reply_date', 'replied_at'],
  verified: ['verified_buyer', 'verified', 'is_verified_buyer', 'verified_purchase'],
  curated: ['curated', 'status'],
} as const

type Field = keyof typeof COLUMNS

export type JudgemeRow = {
  /** 1-based line in the file (after the header), for messages. */
  line: number
  externalId: string
  title: string
  body: string
  rating: number
  date: Date | null
  name: string
  email: string
  handle: string
  /** Shopify's numeric product id, when the export has it. */
  shopifyProductId: string
  productTitle: string
  sku: string
  pictures: string[]
  reply: string
  replyDate: Date | null
  verified: boolean
  /**
   * Judge.me's curation: `hidden` (spam or unpublished there) comes in hidden, `pending`
   * (not curated yet) waits for approval, `ok` follows the import's publish option.
   */
  curation: Curation
  /** No product in the file: a review of the store itself. */
  store: boolean
}

export type Curation = 'ok' | 'pending' | 'hidden'

export type JudgemeParse =
  | { ok: true; rows: JudgemeRow[]; skipped: number }
  | { ok: false; error: 'empty' | 'too_large' | 'not_judgeme' }

const date = (v: string): Date | null => {
  if (!v.trim()) return null
  const d = new Date(v.trim())
  return Number.isNaN(d.getTime()) ? null : d
}

const truthy = (v: string) => /^(true|yes|y|1|verified|verified[ _-]?buyer|buyer)$/i.test(v.trim())

/** Judge.me's `curated` column (`ok`, `spam`, `not-yet`), or a plain status column. */
export function curationOf(raw: string): Curation {
  const v = raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
  if (/^(spam|hidden|unpublished|archived|rejected)$/.test(v)) return 'hidden'
  if (/^(not-yet|pending|unreviewed|awaiting)$/.test(v)) return 'pending'
  return 'ok'
}

/** Shopify's numeric id from `123` or `gid://shopify/Product/123`; '' otherwise. */
const shopifyId = (raw: string) =>
  /^(?:gid:\/\/shopify\/Product\/)?(\d{1,20})$/i.exec(raw)?.[1] ?? ''

/** Only http(s) addresses, at most five per review. */
function pictureUrls(raw: string): string[] {
  return raw
    .split(/[\s,;|]+/)
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\/[^\s]+$/i.test(u))
    .slice(0, MAX_REVIEW_PHOTOS)
}

const fingerprint = (parts: string[]) =>
  `fp:${createHash('sha256').update(parts.join('\u001f')).digest('hex').slice(0, 32)}`

/**
 * Reads the export. Rows without a rating from 1 to 5 are counted as skipped; rows with no
 * product handle, SKU or product id are store reviews.
 */
export function parseJudgemeCsv(text: string): JudgemeParse {
  if (!text.trim()) return { ok: false, error: 'empty' }
  if (new TextEncoder().encode(text).byteLength > JUDGEME_MAX_BYTES) {
    return { ok: false, error: 'too_large' }
  }
  const [header, ...lines] = parseCsv(text)
  if (!header) return { ok: false, error: 'empty' }
  const names = header.map((h) =>
    h
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_'),
  )
  const index = (field: Field) => {
    for (const name of COLUMNS[field]) {
      const i = names.indexOf(name)
      if (i >= 0) return i
    }
    return -1
  }
  const at = Object.fromEntries(
    (Object.keys(COLUMNS) as Field[]).map((f) => [f, index(f)]),
  ) as Record<Field, number>
  if (at.rating < 0 || (at.handle < 0 && at.sku < 0 && at.productId < 0)) {
    return { ok: false, error: 'not_judgeme' }
  }
  if (lines.length > JUDGEME_MAX_ROWS) return { ok: false, error: 'too_large' }
  const cell = (row: string[], f: Field) => (at[f] >= 0 ? (row[at[f]] ?? '').trim() : '')
  const rows: JudgemeRow[] = []
  let skipped = 0
  lines.forEach((r, i) => {
    const rating = Math.round(Number(cell(r, 'rating')))
    const handle = cell(r, 'handle').toLowerCase()
    const sku = cell(r, 'sku')
    const shopifyProductId = shopifyId(cell(r, 'productId'))
    // A blank line between rows (some spreadsheet saves add them) is not a review.
    if (r.every((c) => !c.trim())) return
    if (!(rating >= 1 && rating <= 5)) {
      skipped += 1
      return
    }
    const fields = {
      title: cell(r, 'title').slice(0, 150),
      body: cell(r, 'body').slice(0, 5000),
      name: cell(r, 'name').slice(0, 80),
      email: cell(r, 'email').toLowerCase().slice(0, 254),
    }
    const rawDate = cell(r, 'date')
    const id = cell(r, 'id')
    rows.push({
      line: i + 1,
      externalId: id
        ? `judgeme:${id}`
        : fingerprint([
            handle,
            sku,
            fields.email,
            fields.name,
            rawDate,
            String(rating),
            fields.title,
            fields.body,
          ]),
      ...fields,
      rating,
      date: date(rawDate),
      handle,
      shopifyProductId,
      productTitle: cell(r, 'productTitle').slice(0, 255),
      sku,
      pictures: pictureUrls(cell(r, 'pictures')),
      reply: cell(r, 'reply').slice(0, 2000),
      replyDate: date(cell(r, 'replyDate')),
      verified: truthy(cell(r, 'verified')),
      curation: curationOf(cell(r, 'curated')),
      store: !handle && !sku && !shopifyProductId,
    })
  })
  return { ok: true, rows, skipped }
}

export type MatchResult = 'sku' | 'product_id' | 'handle' | 'store' | 'none' | 'imported'

/**
 * How one row lands: the product it belongs to (null for a store review), or `none` when
 * the file names a product this store does not have.
 */
export type RowMatch = { productId: string | null; result: MatchResult }

export type MatchMaps = {
  bySku: ReadonlyMap<string, string>
  byShopifyId: ReadonlyMap<string, string>
  byHandle: ReadonlyMap<string, string>
  existing: ReadonlySet<string>
}

/** The pure half of matching: SKU, then Shopify product id, then handle. */
export function matchRow(row: JudgemeRow, maps: MatchMaps): RowMatch {
  const sku = row.sku ? maps.bySku.get(row.sku) : undefined
  const byId = row.shopifyProductId ? maps.byShopifyId.get(row.shopifyProductId) : undefined
  const handle = row.handle ? maps.byHandle.get(row.handle) : undefined
  const productId = sku ?? byId ?? handle ?? null
  if (maps.existing.has(row.externalId)) return { productId, result: 'imported' }
  if (sku) return { productId: sku, result: 'sku' }
  if (byId) return { productId: byId, result: 'product_id' }
  if (handle) return { productId: handle, result: 'handle' }
  if (row.store) return { productId: null, result: 'store' }
  return { productId: null, result: 'none' }
}

const chunks = <T>(items: T[], size = 500) => {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Which of our products each row belongs to, and rows this store already has. */
export async function matchJudgemeRows(tx: StoreTx, rows: JudgemeRow[]): Promise<RowMatch[]> {
  const skus = [...new Set(rows.map((r) => r.sku).filter(Boolean))]
  const shopifyIds = [...new Set(rows.map((r) => r.shopifyProductId).filter(Boolean))]
  const handles = [...new Set(rows.map((r) => r.handle).filter(Boolean))]
  const bySku = new Map<string, string>()
  for (const part of chunks(skus)) {
    const found = await tx
      .select({ sku: variant.sku, productId: variant.productId })
      .from(variant)
      .where(inArray(variant.sku, part))
    for (const f of found) if (f.sku && !bySku.has(f.sku)) bySku.set(f.sku, f.productId)
  }
  // Products the Shopify importer brought over keep their Shopify id in its id map
  // (`shopify_import_mapping`; one migration chain, so the table is always there).
  const byShopifyId = new Map<string, string>()
  for (const part of chunks(shopifyIds)) {
    const gids = part.map((id) => sql`${`gid://shopify/Product/${id}`}`)
    const found = await tx.execute<{ source_id: string; local_id: string }>(sql`
      select m.source_id, m.local_id from shopify_import_mapping m
      join ${product} p on p.id = m.local_id
      where m.resource = 'products' and m.source_id in (${sql.join(gids, sql`, `)})`)
    for (const f of found) byShopifyId.set(f.source_id.replace(/^.*\//, ''), f.local_id)
  }
  const byHandle = new Map<string, string>()
  for (const part of chunks(handles)) {
    const found = await tx
      .select({ handle: product.handle, id: product.id })
      .from(product)
      .where(inArray(sql`lower(${product.handle})`, part))
    for (const f of found) byHandle.set(f.handle.toLowerCase(), f.id)
  }
  const existing = new Set<string>()
  for (const part of chunks(rows.map((r) => r.externalId))) {
    const found = await tx
      .select({ id: review.externalId })
      .from(review)
      .where(inArray(review.externalId, part))
    for (const f of found) if (f.id) existing.add(f.id)
  }
  const maps = { bySku, byShopifyId, byHandle, existing }
  return rows.map((r) => matchRow(r, maps))
}

/** Rows the preview table shows. */
const PREVIEW_ROWS = 50
/** Missing products the preview names. */
const UNMATCHED_LISTED = 25

export type JudgemeCounts = {
  total: number
  /** New, matched to a product. */
  ready: number
  /** New store reviews (no product in the file). */
  store: number
  noMatch: number
  already: number
  /** Photos on the new reviews, store reviews included. */
  photos: number
  /** Products the file names that this store does not have, most reviews first. */
  unmatched: { product: string; reviews: number }[]
}

/** The preview's numbers, from the rows and how each matched. */
export function countJudgemeRows(rows: JudgemeRow[], matches: RowMatch[]): JudgemeCounts {
  const out: JudgemeCounts = {
    total: rows.length,
    ready: 0,
    store: 0,
    noMatch: 0,
    already: 0,
    photos: 0,
    unmatched: [],
  }
  const missing = new Map<string, number>()
  matches.forEach((m, i) => {
    const row = rows[i]
    if (!row) return
    if (m.result === 'imported') out.already += 1
    else if (m.result === 'none') {
      out.noMatch += 1
      const name = row.handle || row.sku || `#${row.shopifyProductId}`
      missing.set(name, (missing.get(name) ?? 0) + 1)
    } else {
      if (m.result === 'store') out.store += 1
      else out.ready += 1
      out.photos += row.pictures.length
    }
  })
  out.unmatched = [...missing]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, UNMATCHED_LISTED)
    .map(([product, reviews]) => ({ product, reviews }))
  return out
}

/** The check-before-importing step: counts and the first rows with their match. */
export async function previewJudgemeImport(tx: StoreTx, text: string) {
  const parsed = parseJudgemeCsv(text)
  if (!parsed.ok) return { ok: false as const, error: parsed.error }
  const matches = await matchJudgemeRows(tx, parsed.rows)
  return {
    ok: true as const,
    ...countJudgemeRows(parsed.rows, matches),
    skipped: parsed.skipped,
    rows: parsed.rows.slice(0, PREVIEW_ROWS).map((r, i) => ({
      line: r.line,
      product: r.productTitle || r.handle || r.sku || r.shopifyProductId,
      rating: r.rating,
      title: r.title || r.body.slice(0, 60),
      reviewer: r.name,
      result: matches[i]?.result ?? 'none',
    })),
  }
}

export type JudgemeImportOptions = {
  /** Copy each review's photos into Files (a background job; see `copyReviewPhotos`). */
  copyPhotos: boolean
  /** Imported reviews go live at once; otherwise they wait for approval. */
  publish: boolean
  /** Rows whose product is not here come in as store reviews instead of being left out. */
  unmatchedAsStore?: boolean | undefined
}

/** The status an imported row starts in: Judge.me's curation first, then the option. */
export function importedStatus(curation: Curation, publish: boolean): ReviewStatus {
  if (curation === 'hidden') return 'hidden'
  if (curation === 'pending' || !publish) return 'pending'
  return 'published'
}

/**
 * The rows an import writes and their product: matched rows, store reviews, and (with
 * `unmatchedAsStore`) rows whose product is missing, as store reviews.
 */
export function rowsToImport(
  rows: JudgemeRow[],
  matches: RowMatch[],
  unmatchedAsStore: boolean,
): { row: JudgemeRow; productId: string | null }[] {
  return rows.flatMap((row, i) => {
    const m = matches[i]
    if (!m || m.result === 'imported') return []
    if (m.result === 'none') return unmatchedAsStore ? [{ row, productId: null }] : []
    return [{ row, productId: m.productId }]
  })
}

/**
 * Imports every row the store does not have yet (see `rowsToImport`). Photos are saved as
 * addresses to copy; the caller queues the copy job when `photosToCopy` is above zero.
 */
export async function importJudgemeReviews(
  tx: StoreTx,
  storeId: string,
  text: string,
  options: JudgemeImportOptions,
  now: Date = new Date(),
) {
  const parsed = parseJudgemeCsv(text)
  if (!parsed.ok) return { ok: false as const, error: parsed.error }
  const matches = await matchJudgemeRows(tx, parsed.rows)
  const todo = rowsToImport(parsed.rows, matches, options.unmatchedAsStore === true)
  let imported = 0
  let storeReviews = 0
  let photosToCopy = 0
  for (const part of chunks(todo, 200)) {
    const inserted = await tx
      .insert(review)
      .values(
        part.map(({ row, productId }) => {
          const status = importedStatus(row.curation, options.publish)
          const written = row.date ?? now
          return {
            storeId,
            productId,
            rating: row.rating,
            title: row.title,
            body: row.body,
            reviewerName: row.name || 'Customer',
            reviewerEmail: row.email || null,
            status,
            verifiedBuyer: row.verified,
            source: 'judgeme' as const,
            externalId: row.externalId,
            reply: row.reply || null,
            replyAt: row.reply ? (row.replyDate ?? written) : null,
            publishedAt: status === 'published' ? now : null,
            hiddenAt: status === 'hidden' ? now : null,
            createdAt: written,
            updatedAt: now,
          }
        }),
      )
      .onConflictDoNothing()
      .returning({ id: review.id, externalId: review.externalId, productId: review.productId })
    imported += inserted.length
    storeReviews += inserted.filter((r) => r.productId === null).length
    if (!options.copyPhotos) continue
    const photoRows = inserted.flatMap((ins) => {
      const row = part.find((t) => t.row.externalId === ins.externalId)?.row
      return (row?.pictures ?? []).map((sourceUrl, position) => ({
        storeId,
        reviewId: ins.id,
        sourceUrl,
        position,
      }))
    })
    if (photoRows.length > 0) {
      await tx.insert(reviewMedia).values(photoRows)
      photosToCopy += photoRows.length
    }
  }
  const counts = countJudgemeRows(parsed.rows, matches)
  return {
    ok: true as const,
    imported,
    storeReviews,
    alreadyHere: counts.already,
    noMatch: options.unmatchedAsStore ? 0 : counts.noMatch,
    photosToCopy,
  }
}
