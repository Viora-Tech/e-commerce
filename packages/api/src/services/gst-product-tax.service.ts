/** SOURCE OF TRUTH: GST and HSN per product for the GST invoices app — WHAT: every product's Charge GST switch, GST rate and HSN code, read and set many at a time / WHY: checkout and invoices read these per variant, and one table is quicker than opening 250 products */
import { media, product, productMedia, type StoreTx, store, variant } from '@commerce/db'
import { and, asc, count, eq, ilike, inArray, isNull, ne, type SQL, sql } from 'drizzle-orm'

/** GST rates a product can be set to (GST 2.0 slabs, plus the older ones still on the books). */
export const GST_RATES = [0, 3, 5, 12, 18, 28, 40] as const

export const PRODUCT_TAX_FILTERS = ['all', 'missing_hsn', 'missing_rate', 'gst_off'] as const
export type ProductTaxFilter = (typeof PRODUCT_TAX_FILTERS)[number]

export type ProductTaxMatch = { filter: ProductTaxFilter; search?: string | undefined }

/** Most products one change touches ("all matching" on a large catalogue). */
const MAX_MATCH = 5000

/** A variant's HSN, its own else its product's. */
const effectiveHsn = sql`coalesce(nullif(${variant.hsCode}, ''), nullif(${product.hsCode}, ''))`

const live = and(
  eq(product.isGiftCard, false),
  eq(product.isSystemTest, false),
  ne(product.status, 'archived'),
  isNull(variant.archivedAt),
)

const having: Record<ProductTaxFilter, SQL | undefined> = {
  all: undefined,
  missing_hsn: sql`count(*) filter (where ${effectiveHsn} is null) > 0`,
  /* No rate of its own on the variant or the product: it falls back to the store rate. */
  missing_rate: sql`count(*) filter (where coalesce(${variant.gstRatePercent}, ${product.gstRatePercent}) is null) > 0`,
  gst_off: sql`count(*) filter (where not ${variant.taxable}) > 0`,
}

function grouped(tx: StoreTx, match: ProductTaxMatch) {
  const search = match.search?.trim()
  return tx
    .select({
      id: product.id,
      title: product.title,
      hsCode: product.hsCode,
      gstRatePercent: product.gstRatePercent,
      variants: count(variant.id),
      taxed: sql<number>`count(*) filter (where ${variant.taxable})`.mapWith(Number),
      variantHsn: sql<string | null>`min(nullif(${variant.hsCode}, ''))`,
      hsnKinds: sql<number>`count(distinct nullif(${variant.hsCode}, ''))`.mapWith(Number),
      missingHsn: sql<number>`count(*) filter (where ${effectiveHsn} is null)`.mapWith(Number),
      variantRate: sql<number | null>`min(${variant.gstRatePercent})`,
      rateKinds: sql<number>`count(distinct ${variant.gstRatePercent})`.mapWith(Number),
    })
    .from(product)
    .innerJoin(variant, eq(variant.productId, product.id))
    .where(and(live, search ? ilike(product.title, `%${search}%`) : undefined))
    .groupBy(product.id)
    .having(having[match.filter])
}

export type ProductTaxRow = {
  id: string
  title: string
  /** The product's first photo, for the row's thumbnail. */
  imageUrl: string | null
  variants: number
  /** On for every variant, off for every one, or a mix. */
  charge: 'on' | 'off' | 'mixed'
  /** The HSN the product's invoices print; null when none is set, `mixed` when variants differ. */
  hsCode: string | null
  hsnMixed: boolean
  /** Variants with no HSN at all. */
  missingHsn: number
  /** Null uses the store rate. */
  gstRatePercent: number | null
  rateMixed: boolean
}

/** Each product's first photo (lowest position), for this page's rows only. */
async function firstImages(tx: StoreTx, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  const rows = await tx
    .select({ productId: productMedia.productId, url: media.url })
    .from(productMedia)
    .innerJoin(media, eq(media.id, productMedia.mediaId))
    .where(inArray(productMedia.productId, ids))
    .orderBy(asc(productMedia.position))
  const out = new Map<string, string>()
  for (const r of rows) if (!out.has(r.productId)) out.set(r.productId, r.url)
  return out
}

export async function listProductTax(
  tx: StoreTx,
  input: ProductTaxMatch & { page: number; perPage: number },
) {
  const sq = grouped(tx, input).as('t')
  const [rows, [total], [s]] = await Promise.all([
    grouped(tx, input)
      .orderBy(asc(product.title))
      .limit(input.perPage)
      .offset((input.page - 1) * input.perPage),
    tx.select({ n: count() }).from(sq),
    tx.select({ rate: store.gstRatePercent }).from(store),
  ])
  const images = await firstImages(
    tx,
    rows.map((r) => r.id),
  )
  const items: ProductTaxRow[] = rows.map((r) => {
    const hsnMixed = !r.hsCode && r.hsnKinds > 1
    const rateMixed = r.gstRatePercent === null && r.rateKinds > 1
    return {
      id: r.id,
      title: r.title,
      imageUrl: images.get(r.id) ?? null,
      variants: r.variants,
      charge: r.taxed === r.variants ? 'on' : r.taxed === 0 ? 'off' : 'mixed',
      hsCode: r.hsCode?.trim() || (hsnMixed ? null : r.variantHsn),
      hsnMixed,
      missingHsn: r.missingHsn,
      gstRatePercent: r.gstRatePercent ?? (rateMixed ? null : r.variantRate),
      rateMixed,
    }
  })
  return { items, total: total?.n ?? 0, storeRatePercent: s?.rate ?? 18 }
}

export type ProductTaxChange = {
  hsCode?: string | null | undefined
  gstRatePercent?: number | null | undefined
  taxable?: boolean | undefined
}

/**
 * Sets the chosen products' GST. HSN and rate are written on the product and cleared on its
 * variants, so every variant follows what the table shows; Charge GST is per variant.
 */
export async function updateProductTax(
  tx: StoreTx,
  target: { ids: string[] } | { match: ProductTaxMatch },
  change: ProductTaxChange,
): Promise<{ products: number }> {
  const ids =
    'ids' in target
      ? target.ids
      : (await grouped(tx, target.match).limit(MAX_MATCH)).map((r) => r.id)
  if (ids.length === 0) return { products: 0 }
  const now = new Date()
  const own: Partial<typeof product.$inferInsert> = {}
  const onVariants: Partial<typeof variant.$inferInsert> = {}
  if (change.hsCode !== undefined) {
    own.hsCode = change.hsCode
    onVariants.hsCode = null
  }
  if (change.gstRatePercent !== undefined) {
    own.gstRatePercent = change.gstRatePercent
    onVariants.gstRatePercent = null
  }
  if (change.taxable !== undefined) onVariants.taxable = change.taxable
  if (Object.keys(own).length > 0) {
    await tx
      .update(product)
      .set({ ...own, updatedAt: now })
      .where(inArray(product.id, ids))
  }
  if (Object.keys(onVariants).length > 0) {
    await tx
      .update(variant)
      .set({ ...onVariants, updatedAt: now })
      .where(inArray(variant.productId, ids))
  }
  return { products: ids.length }
}
