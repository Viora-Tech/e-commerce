import { createHash } from 'node:crypto'
import { parseCsv } from '@commerce/core'
import { product, type StoreTx, variant } from '@commerce/db'
import { inArray, sql } from 'drizzle-orm'
import { type ReviewStatus, review, reviewMedia } from './schema'
import { MAX_REVIEW_PHOTOS } from './settings'

/*
 * Judge.me's "Product reviews" CSV (Judge.me → Settings → Data export → Export reviews).
 * Column names vary a little between export versions, so each field reads the first of
 * its known names. A review is matched to one of our products by SKU first, then by the
 * product handle (the Shopify importer keeps handles). Importing is idempotent: each row
 * carries an external id (Judge.me's review id, or a fingerprint of the row when the
 * export has none), unique per store, and a row whose id is already here is skipped.
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
  productTitle: ['product_title', 'product_name'],
  sku: ['product_sku', 'sku'],
  pictures: ['picture_urls', 'pictures', 'photo_urls', 'image_urls'],
  reply: ['reply', 'store_reply', 'shop_reply'],
  replyDate: ['reply_date', 'replied_at'],
  verified: ['verified_buyer', 'verified', 'is_verified_buyer'],
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
  productTitle: string
  sku: string
  pictures: string[]
  reply: string
  replyDate: Date | null
  verified: boolean
  /** Judge.me marked it spam: it comes in hidden. */
  spam: boolean
}

export type JudgemeParse =
  | { ok: true; rows: JudgemeRow[]; skipped: number }
  | { ok: false; error: 'empty' | 'too_large' | 'not_judgeme' }

const date = (v: string): Date | null => {
  if (!v.trim()) return null
  const d = new Date(v.trim())
  return Number.isNaN(d.getTime()) ? null : d
}

const truthy = (v: string) => /^(true|yes|1|verified|verified_buyer|buyer)$/i.test(v.trim())

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

/** Reads the export. Rows without a rating from 1 to 5 or without a product are counted as skipped. */
export function parseJudgemeCsv(text: string): JudgemeParse {
  if (!text.trim()) return { ok: false, error: 'empty' }
  if (new TextEncoder().encode(text).byteLength > JUDGEME_MAX_BYTES) {
    return { ok: false, error: 'too_large' }
  }
  const [header, ...lines] = parseCsv(text)
  if (!header) return { ok: false, error: 'empty' }
  const names = header.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))
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
  if (at.rating < 0 || (at.handle < 0 && at.sku < 0)) return { ok: false, error: 'not_judgeme' }
  if (lines.length > JUDGEME_MAX_ROWS) return { ok: false, error: 'too_large' }
  const cell = (row: string[], f: Field) => (at[f] >= 0 ? (row[at[f]] ?? '').trim() : '')
  const rows: JudgemeRow[] = []
  let skipped = 0
  lines.forEach((r, i) => {
    const rating = Math.round(Number(cell(r, 'rating')))
    const handle = cell(r, 'handle').toLowerCase()
    const sku = cell(r, 'sku')
    if (!(rating >= 1 && rating <= 5) || (!handle && !sku)) {
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
      productTitle: cell(r, 'productTitle').slice(0, 255),
      sku,
      pictures: pictureUrls(cell(r, 'pictures')),
      reply: cell(r, 'reply').slice(0, 2000),
      replyDate: date(cell(r, 'replyDate')),
      verified: truthy(cell(r, 'verified')),
      spam: /^spam$/i.test(cell(r, 'curated')),
    })
  })
  return { ok: true, rows, skipped }
}

export type MatchResult = 'sku' | 'handle' | 'none' | 'imported'

/** Which of our products each row belongs to, and rows this store already has. */
export async function matchJudgemeRows(
  tx: StoreTx,
  rows: JudgemeRow[],
): Promise<{ productId: string | null; result: MatchResult }[]> {
  const skus = [...new Set(rows.map((r) => r.sku).filter(Boolean))]
  const handles = [...new Set(rows.map((r) => r.handle).filter(Boolean))]
  const bySku = new Map<string, string>()
  for (let i = 0; i < skus.length; i += 500) {
    const part = skus.slice(i, i + 500)
    const found = await tx
      .select({ sku: variant.sku, productId: variant.productId })
      .from(variant)
      .where(inArray(variant.sku, part))
    for (const f of found) if (f.sku && !bySku.has(f.sku)) bySku.set(f.sku, f.productId)
  }
  const byHandle = new Map<string, string>()
  for (let i = 0; i < handles.length; i += 500) {
    const part = handles.slice(i, i + 500)
    const found = await tx
      .select({ handle: product.handle, id: product.id })
      .from(product)
      .where(inArray(sql`lower(${product.handle})`, part))
    for (const f of found) byHandle.set(f.handle.toLowerCase(), f.id)
  }
  const ids = rows.map((r) => r.externalId)
  const existing = new Set<string>()
  for (let i = 0; i < ids.length; i += 500) {
    const part = ids.slice(i, i + 500)
    const found = await tx
      .select({ id: review.externalId })
      .from(review)
      .where(inArray(review.externalId, part))
    for (const f of found) if (f.id) existing.add(f.id)
  }
  return rows.map((r) => {
    const sku = r.sku ? bySku.get(r.sku) : undefined
    const handle = r.handle ? byHandle.get(r.handle) : undefined
    const productId = sku ?? handle ?? null
    if (existing.has(r.externalId)) return { productId, result: 'imported' }
    if (sku) return { productId: sku, result: 'sku' }
    if (handle) return { productId: handle, result: 'handle' }
    return { productId: null, result: 'none' }
  })
}

/** Rows the preview table shows. */
const PREVIEW_ROWS = 50

/** The check-before-importing step: counts and the first rows with their match. */
export async function previewJudgemeImport(tx: StoreTx, text: string) {
  const parsed = parseJudgemeCsv(text)
  if (!parsed.ok) return { ok: false as const, error: parsed.error }
  const matches = await matchJudgemeRows(tx, parsed.rows)
  let ready = 0
  let noMatch = 0
  let already = 0
  let photos = 0
  matches.forEach((m, i) => {
    if (m.result === 'imported') already += 1
    else if (m.result === 'none') noMatch += 1
    else {
      ready += 1
      photos += parsed.rows[i]?.pictures.length ?? 0
    }
  })
  return {
    ok: true as const,
    total: parsed.rows.length,
    ready,
    noMatch,
    already,
    photos,
    skipped: parsed.skipped,
    rows: parsed.rows.slice(0, PREVIEW_ROWS).map((r, i) => ({
      line: r.line,
      product: r.productTitle || r.handle || r.sku,
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
}

/**
 * Imports every matched row the store does not have yet. Unmatched rows are left out (a
 * review needs a product). Photos are saved as addresses to copy; the caller queues the
 * copy job when `photosToCopy` is above zero.
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
  const todo = parsed.rows
    .map((row, i) => ({
      row,
      productId: matches[i]?.productId ?? null,
      result: matches[i]?.result,
    }))
    .filter(
      (t): t is { row: JudgemeRow; productId: string; result: MatchResult } =>
        Boolean(t.productId) && t.result !== 'imported' && t.result !== 'none',
    )
  let imported = 0
  let photosToCopy = 0
  for (let i = 0; i < todo.length; i += 200) {
    const part = todo.slice(i, i + 200)
    const inserted = await tx
      .insert(review)
      .values(
        part.map(({ row, productId }) => {
          const status: ReviewStatus = row.spam
            ? 'hidden'
            : options.publish
              ? 'published'
              : 'pending'
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
      .returning({ id: review.id, externalId: review.externalId })
    imported += inserted.length
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
  return {
    ok: true as const,
    imported,
    alreadyHere: matches.filter((m) => m.result === 'imported').length,
    noMatch: matches.filter((m) => m.result === 'none').length,
    photosToCopy,
  }
}
