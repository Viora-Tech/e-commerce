/** SOURCE OF TRUTH: list binding loading — WHAT the rows behind a template's loops (`./loops.ts`) for one request: active entries of a content type, or a collection's products, capped at 50 per list and read under RLS / WHY sections that repeat rows (FAQ, quotes, logos, people) fill from store data at render time, batched so a page with several lists makes a few queries, not one per row. */
import { metaobjectDefinition, type StoreTx } from '@commerce/db'
import { and, eq, inArray } from 'drizzle-orm'
import type { FieldType } from '../metaobjects/schemas'
import { metaobjectsByType } from '../metaobjects/storefront'
import {
  LOOP_PRODUCT_FIELDS,
  type LoopRow,
  type LoopSpec,
  type LoopValues,
  loopKey,
  loopLimit,
  parseLoopSource,
} from './loops'

/** A product card as the storefront's own catalogue loader returns it (visibility and order are its job). */
export type LoopProduct = {
  handle: string
  title: string
  vendor: string | null
  productType: string | null
  pricePaise: number
  mrpPaise: number | null
  images: { url: string; alt: string | null }[]
}

export type LoopLoaders = {
  /** A collection's visible products in its own order, at most `limit`; empty when it has none. */
  collectionProducts?: ((handle: string, limit: number) => Promise<LoopProduct[]>) | undefined
}

function productRow(p: LoopProduct): LoopRow {
  const image = p.images[0]
  const values: Record<keyof typeof LOOP_PRODUCT_FIELDS, unknown> = {
    title: p.title,
    price: p.pricePaise,
    compare_at_price: p.mrpPaise && p.mrpPaise > p.pricePaise ? p.mrpPaise : null,
    vendor: p.vendor,
    type: p.productType,
    featured_image: image ? { url: image.url, alt: image.alt ?? p.title } : null,
    url: `/products/${p.handle}`,
  }
  const row: LoopRow = {}
  for (const [key, type] of Object.entries(LOOP_PRODUCT_FIELDS)) {
    row[key] = { type, value: values[key as keyof typeof LOOP_PRODUCT_FIELDS] }
  }
  return row
}

/** Rows for every metaobject loop: one definition query, then each type's entries once. */
async function metaobjectRows(
  tx: StoreTx,
  wanted: { key: string; type: string; limit: number }[],
  out: LoopValues,
) {
  const types = [...new Set(wanted.map((w) => w.type))]
  const defs = await tx
    .select({ type: metaobjectDefinition.type, fields: metaobjectDefinition.fields })
    .from(metaobjectDefinition)
    .where(
      and(
        inArray(metaobjectDefinition.type, types),
        eq(metaobjectDefinition.storefrontAccess, true),
      ),
    )
  for (const def of defs) {
    const loops = wanted.filter((w) => w.type === def.type)
    const most = Math.max(...loops.map((w) => w.limit))
    const entries = await metaobjectsByType({ tx }, def.type, { limit: most })
    const rows = entries.map((entry) => {
      const row: LoopRow = { handle: { type: 'single_line_text', value: entry.handle } }
      for (const f of def.fields) {
        row[f.key] = { type: f.type as FieldType, value: entry.fields[f.key] }
      }
      return row
    })
    for (const w of loops) out[w.key] = rows.slice(0, w.limit)
  }
}

/**
 * The rows of the given loops for one request, keyed by `loopKey`. A list that cannot be read
 * (a hidden or deleted content type, an unknown collection, no product loader) is simply
 * absent, and its loop renders its typed-in rows.
 */
export async function loadLoopValues(
  tx: StoreTx,
  loops: readonly LoopSpec[],
  loaders: LoopLoaders = {},
): Promise<LoopValues> {
  const out: LoopValues = {}
  const objects: { key: string; type: string; limit: number }[] = []
  const collections: { key: string; handle: string; limit: number }[] = []
  for (const spec of loops) {
    const parsed = parseLoopSource(spec.source)
    if (!parsed) continue
    const entry = { key: loopKey(spec), limit: loopLimit(spec) }
    if (parsed.scope === 'metaobject') objects.push({ ...entry, type: parsed.type })
    else collections.push({ ...entry, handle: parsed.handle })
  }
  if (objects.length) await metaobjectRows(tx, objects, out)
  const load = loaders.collectionProducts
  if (load && collections.length) {
    const handles = [...new Set(collections.map((c) => c.handle))]
    await Promise.all(
      handles.map(async (handle) => {
        const wanted = collections.filter((c) => c.handle === handle)
        const most = Math.max(...wanted.map((c) => c.limit))
        const rows = (await load(handle, most)).map(productRow)
        for (const c of wanted) out[c.key] = rows.slice(0, c.limit)
      }),
    )
  }
  return out
}
