/**
 * "Add 8 products to new collection Glasspads". Creates a manual collection with products, or
 * adds products to an existing manual one, through the same core service as Collections.
 * Undo hides a new collection (it becomes a draft) or takes the added products back out.
 */
import { descriptionFromText } from '@commerce/ai'
import { createCollection, notSystemTest, permissions } from '@commerce/core'
import { collection, collectionProduct, product } from '@commerce/db'
import {
  and,
  arrayContains,
  asc,
  eq,
  ilike,
  inArray,
  max,
  ne,
  notInArray,
  type SQL,
} from 'drizzle-orm'
import { z } from 'zod'
import { findCollections, findProductsByName, listed, MAX_ITEMS, ProposalProblem } from './resolve'
import { type ActionEnv, defineAction } from './types'

const Input = z.object({
  title: z.string().trim().min(1).max(200).describe('Name of the new collection.'),
  collection: z
    .string()
    .max(200)
    .optional()
    .describe(
      'Instead of a new one: an existing manual collection (title or handle) to add the products to.',
    ),
  products: z
    .array(z.string().max(200))
    .max(MAX_ITEMS)
    .optional()
    .describe('Product titles or handles.'),
  search: z
    .string()
    .max(100)
    .optional()
    .describe('Pick products whose title contains these words.'),
  tag: z.string().max(60).optional().describe('Pick products with this tag.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_ITEMS)
    .default(50)
    .describe('Most products to pick by search or tag.'),
  description: z
    .string()
    .max(2000)
    .optional()
    .describe('Optional collection description, plain text.'),
})
type Raw = z.infer<typeof Input>

type Resolved = {
  mode: 'create' | 'add'
  collectionId: string | null
  title: string
  description: string | null
  productIds: string[]
}
type Undo = { mode: 'create' | 'add'; collectionId: string; productIds: string[] }

async function pickProducts(env: ActionEnv, raw: Raw, exclude: string[]) {
  if (raw.products?.length) {
    const { found, missing } = await findProductsByName(env.tx, raw.products)
    if (missing.length)
      throw new ProposalProblem(`No product called ${listed(missing.map((m) => `"${m}"`))}.`)
    return found.filter((p) => !exclude.includes(p.id))
  }
  const where: SQL[] = []
  if (raw.search?.trim())
    where.push(ilike(product.title, `%${raw.search.trim().replace(/[%_]/g, '')}%`))
  if (raw.tag?.trim()) where.push(arrayContains(product.tags, [raw.tag.trim()]))
  if (!where.length)
    throw new ProposalProblem('Say which products: names, a title search or a tag.')
  if (exclude.length) where.push(notInArray(product.id, exclude))
  return env.tx
    .select({ id: product.id, title: product.title, handle: product.handle })
    .from(product)
    .where(and(notSystemTest, ne(product.status, 'archived'), ...where))
    .orderBy(asc(product.title))
    .limit(raw.limit)
}

export const collectionAction = defineAction<Raw, Resolved>({
  tool: 'proposeCollection',
  permission: permissions.PRODUCTS_WRITE,
  description:
    'Draft a new manual collection with products, or adding products to an existing manual collection (at most 200). The merchant approves it first; it can be undone.',
  input: Input,
  editFields: (raw) => [
    { key: 'title', kind: 'text', value: raw.title },
    { key: 'limit', kind: 'number', value: raw.limit },
  ],
  propose: async (env, raw) => {
    let existing: { id: string; title: string } | null = null
    let members: string[] = []
    if (raw.collection) {
      const { found } = await findCollections(env.tx, [raw.collection])
      const hit = found[0]
      if (!hit) throw new ProposalProblem(`No collection called "${raw.collection}".`)
      if (hit.kind !== 'manual') {
        throw new ProposalProblem(
          `"${hit.title}" picks its products by rules, so products cannot be added by hand.`,
        )
      }
      existing = hit
      members = (
        await env.tx
          .select({ id: collectionProduct.productId })
          .from(collectionProduct)
          .where(eq(collectionProduct.collectionId, hit.id))
      ).map((m) => m.id)
    } else {
      const [clash] = await env.tx
        .select({ id: collection.id })
        .from(collection)
        .where(eq(collection.title, raw.title.trim()))
      if (clash) {
        throw new ProposalProblem(
          `A collection called "${raw.title}" already exists. Add to it instead, or pick another name.`,
        )
      }
    }
    const picked = await pickProducts(env, raw, members)
    if (!picked.length)
      throw new ProposalProblem('No matching products found (or they are all in it already).')
    const title = existing?.title ?? raw.title.trim()
    const n = picked.length
    const noun = n === 1 ? 'product' : 'products'
    return {
      summary: existing
        ? `Add ${n} ${noun} to collection ${title}`
        : `Add ${n} ${noun} to new collection ${title}`,
      resolved: {
        mode: existing ? 'add' : 'create',
        collectionId: existing?.id ?? null,
        title,
        description: raw.description?.trim() || null,
        productIds: picked.map((p) => p.id),
      },
      preview: {
        title: existing ? `Add ${n} ${noun} to ${title}` : `Create collection ${title}`,
        lines: [
          {
            label: 'Collection',
            value: existing ? `${title} (has ${members.length})` : `${title} (new, manual)`,
          },
          { label: 'Products', value: String(n) },
        ],
        rows: picked.slice(0, 50).map((p) => ({ label: p.title, before: '', after: 'Added' })),
        more: Math.max(0, n - 50),
        count: n,
        undoable: true,
        notes: existing ? [] : ['The new collection is visible in your store once approved.'],
      },
    }
  },
  execute: async (env, resolved) => {
    const own = await env.tx
      .select({ id: product.id })
      .from(product)
      .where(inArray(product.id, resolved.productIds))
    const productIds = resolved.productIds.filter((id) => own.some((o) => o.id === id))
    if (resolved.mode === 'create') {
      const id = await createCollection(env.tx, env.storeId, {
        title: resolved.title,
        kind: 'manual',
        description: resolved.description ? descriptionFromText(resolved.description) : null,
        productIds,
      })
      return {
        message: `Collection ${resolved.title} created with ${productIds.length} products`,
        href: `/products/collections/${id}`,
        result: { collectionId: id, added: productIds.length },
        undo: { mode: 'create', collectionId: id, productIds } satisfies Undo,
      }
    }
    const collectionId = resolved.collectionId as string
    const [target] = await env.tx
      .select({ id: collection.id })
      .from(collection)
      .where(eq(collection.id, collectionId))
    if (!target) throw new ProposalProblem('That collection no longer exists.')
    const present = await env.tx
      .select({ id: collectionProduct.productId })
      .from(collectionProduct)
      .where(eq(collectionProduct.collectionId, collectionId))
    const fresh = productIds.filter((id) => !present.some((p) => p.id === id))
    const [last] = await env.tx
      .select({ n: max(collectionProduct.position) })
      .from(collectionProduct)
      .where(eq(collectionProduct.collectionId, collectionId))
    const start = (last?.n ?? -1) + 1
    if (fresh.length) {
      await env.tx.insert(collectionProduct).values(
        fresh.map((productId, i) => ({
          storeId: env.storeId,
          collectionId,
          productId,
          position: start + i,
        })),
      )
    }
    return {
      message: `${fresh.length} products added to ${resolved.title}`,
      href: `/products/collections/${collectionId}`,
      result: { collectionId, added: fresh.length },
      undo: fresh.length ? ({ mode: 'add', collectionId, productIds: fresh } satisfies Undo) : null,
    }
  },
  undo: async (env, undo) => {
    const { mode, collectionId, productIds } = undo as Undo
    if (mode === 'create') {
      const [row] = await env.tx
        .update(collection)
        .set({ status: 'draft', updatedAt: new Date() })
        .where(eq(collection.id, collectionId))
        .returning({ title: collection.title })
      if (!row) throw new ProposalProblem('That collection no longer exists.')
      return `Collection ${row.title} hidden (set to draft)`
    }
    const removed = await env.tx
      .delete(collectionProduct)
      .where(
        and(
          eq(collectionProduct.collectionId, collectionId),
          inArray(collectionProduct.productId, productIds),
        ),
      )
      .returning({ id: collectionProduct.id })
    return `${removed.length} products taken back out of the collection`
  },
})
