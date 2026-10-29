/**
 * "Update 12 product prices +5%". Changes variant prices by a percentage for a collection, a
 * tag, a title search or named products (at most 200 variants). Runs only the exact prices
 * the merchant saw: a variant whose price changed since the proposal is left alone. Undo puts
 * the old prices back on variants still at the new price. Never goes above a variant's MRP.
 */
import { notSystemTest, permissions, syncAutomaticCollections } from '@commerce/core'
import { collectionProduct, product, variant } from '@commerce/db'
import { and, arrayContains, asc, eq, ilike, inArray, isNull, ne, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import {
  findCollections,
  findProductsByName,
  listed,
  MAX_ITEMS,
  ProposalProblem,
  rupees,
} from './resolve'
import { type ActionEnv, defineAction } from './types'

const Input = z.object({
  percent: z
    .number()
    .describe('Change in percent: 5 raises prices 5%, -10 lowers them 10%. Between -50 and 100.'),
  collection: z
    .string()
    .max(200)
    .optional()
    .describe('Only products in this collection (title or handle).'),
  tag: z.string().max(60).optional().describe('Only products with this tag.'),
  search: z
    .string()
    .max(100)
    .optional()
    .describe('Only products whose title contains these words.'),
  products: z
    .array(z.string().max(200))
    .max(MAX_ITEMS)
    .optional()
    .describe('Only these products (titles or handles).'),
  rounding: z
    .enum(['none', 'whole', 'nine'])
    .default('whole')
    .describe('whole: round to whole rupees; nine: end in 9 (₹1,999); none: keep paise.'),
})
type Raw = z.infer<typeof Input>

type Change = { variantId: string; label: string; before: number; after: number }
type Resolved = { percent: number; changes: Change[] }
type Undo = { changes: Change[] }

const MIN = -50
const MAX = 100

function newPrice(before: number, percent: number, rounding: Raw['rounding']): number {
  const raw = before * (1 + percent / 100)
  if (rounding === 'none') return Math.max(100, Math.round(raw))
  const rupeesValue = Math.round(raw / 100)
  if (rounding === 'whole') return Math.max(1, rupeesValue) * 100
  const nine = Math.max(9, Math.ceil((rupeesValue + 1) / 10) * 10 - 1)
  return nine * 100
}

async function scopeFilter(env: ActionEnv, raw: Raw): Promise<{ where: SQL[]; scope: string }> {
  const where: SQL[] = []
  const parts: string[] = []
  if (raw.collection) {
    const { found } = await findCollections(env.tx, [raw.collection])
    const hit = found[0]
    if (!hit)
      throw new ProposalProblem(
        `No collection called "${raw.collection}". Use listCollections to see them.`,
      )
    const members = await env.tx
      .select({ id: collectionProduct.productId })
      .from(collectionProduct)
      .where(eq(collectionProduct.collectionId, hit.id))
    where.push(
      inArray(product.id, [...members.map((m) => m.id), '00000000-0000-0000-0000-000000000000']),
    )
    parts.push(`collection ${hit.title}`)
  }
  if (raw.tag) {
    where.push(arrayContains(product.tags, [raw.tag.trim()]))
    parts.push(`tag "${raw.tag.trim()}"`)
  }
  if (raw.search?.trim()) {
    where.push(ilike(product.title, `%${raw.search.trim().replace(/[%_]/g, '')}%`))
    parts.push(`"${raw.search.trim()}" in the title`)
  }
  if (raw.products?.length) {
    const { found, missing } = await findProductsByName(env.tx, raw.products)
    if (missing.length)
      throw new ProposalProblem(`No product called ${listed(missing.map((m) => `"${m}"`))}.`)
    where.push(
      inArray(
        product.id,
        found.map((p) => p.id),
      ),
    )
    parts.push(listed(found.map((p) => p.title)))
  }
  return { where, scope: parts.length ? parts.join(', ') : 'all products' }
}

export const priceChangeAction = defineAction<Raw, Resolved>({
  tool: 'proposePriceChange',
  permission: permissions.PRODUCTS_WRITE,
  description:
    'Draft a price change by a percentage for products in a collection, with a tag, matching a title search, or named products (at most 200 variants). Shows every old and new price; the merchant approves it, and it can be undone.',
  input: Input,
  editFields: (raw) => [{ key: 'percent', kind: 'number', value: raw.percent }],
  propose: async (env, raw) => {
    if (
      !Number.isFinite(raw.percent) ||
      raw.percent === 0 ||
      raw.percent < MIN ||
      raw.percent > MAX
    ) {
      throw new ProposalProblem(`The change must be between ${MIN}% and +${MAX}%, and not 0.`)
    }
    const { where, scope } = await scopeFilter(env, raw)
    const rows = await env.tx
      .select({
        variantId: variant.id,
        title: product.title,
        variantTitle: variant.title,
        price: variant.pricePaise,
        mrp: variant.mrpPaise,
      })
      .from(variant)
      .innerJoin(product, eq(product.id, variant.productId))
      .where(
        and(notSystemTest, ne(product.status, 'archived'), isNull(variant.archivedAt), ...where),
      )
      .orderBy(asc(product.title), asc(variant.position))
      .limit(MAX_ITEMS + 1)
    if (!rows.length) throw new ProposalProblem(`No products found for ${scope}.`)
    if (rows.length > MAX_ITEMS) {
      throw new ProposalProblem(
        `That is more than ${MAX_ITEMS} variants. The assistant changes at most ${MAX_ITEMS} at once: narrow it to a collection or a tag.`,
      )
    }
    let capped = 0
    const changes: Change[] = rows.flatMap((r) => {
      // A variant listed without a price yet (#913) has nothing to scale.
      if (r.price == null) return []
      let after = newPrice(r.price, raw.percent, raw.rounding)
      if (r.mrp && after > r.mrp) {
        after = r.mrp
        capped++
      }
      if (after === r.price) return []
      const label =
        r.variantTitle && r.variantTitle !== 'Default' ? `${r.title} (${r.variantTitle})` : r.title
      return [{ variantId: r.variantId, label, before: r.price, after }]
    })
    if (!changes.length) throw new ProposalProblem('None of those prices would change.')
    const sign = raw.percent > 0 ? '+' : ''
    const products = new Set(rows.map((r) => r.title)).size
    return {
      summary: `Update ${changes.length} ${changes.length === 1 ? 'price' : 'prices'} ${sign}${raw.percent}% (${scope})`,
      resolved: { percent: raw.percent, changes },
      preview: {
        title: `Change ${changes.length} ${changes.length === 1 ? 'price' : 'prices'} by ${sign}${raw.percent}%`,
        lines: [
          { label: 'Products', value: `${products} (${scope})` },
          {
            label: 'Rounding',
            value:
              raw.rounding === 'nine'
                ? 'Ends in 9'
                : raw.rounding === 'whole'
                  ? 'Whole rupees'
                  : 'None',
          },
        ],
        rows: changes.slice(0, 50).map((c) => ({
          label: c.label,
          before: rupees(env, c.before),
          after: rupees(env, c.after),
        })),
        more: Math.max(0, changes.length - 50),
        count: changes.length,
        undoable: true,
        notes: capped ? [`${capped} would go above their MRP, so they stop at the MRP.`] : [],
      },
    }
  },
  execute: async (env, resolved) => {
    const applied: Change[] = []
    for (const change of resolved.changes) {
      const [row] = await env.tx
        .update(variant)
        .set({ pricePaise: change.after })
        .where(and(eq(variant.id, change.variantId), eq(variant.pricePaise, change.before)))
        .returning({ id: variant.id })
      if (row) applied.push(change)
    }
    if (applied.length) await syncAutomaticCollections(env.tx, env.storeId)
    const skipped = resolved.changes.length - applied.length
    return {
      message:
        `${applied.length} ${applied.length === 1 ? 'price' : 'prices'} updated` +
        (skipped ? ` (${skipped} had changed since and were left alone)` : ''),
      href: '/products',
      result: { updated: applied.length, skipped },
      undo: applied.length ? ({ changes: applied } satisfies Undo) : null,
    }
  },
  undo: async (env, undo) => {
    const { changes } = undo as Undo
    let restored = 0
    for (const change of changes) {
      const [row] = await env.tx
        .update(variant)
        .set({ pricePaise: change.before })
        .where(and(eq(variant.id, change.variantId), eq(variant.pricePaise, change.after)))
        .returning({ id: variant.id })
      if (row) restored++
    }
    if (restored) await syncAutomaticCollections(env.tx, env.storeId)
    const left = changes.length - restored
    return (
      `Old prices put back on ${restored} ${restored === 1 ? 'variant' : 'variants'}` +
      (left ? ` (${left} had been changed again since and were left alone)` : '')
    )
  },
})
