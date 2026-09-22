import { asc, eq, inArray, isNull, min } from 'drizzle-orm'
import { createDb } from './client'
import type { CollectionRules } from './schema'
import { collection, collectionProduct, product, store, variant } from './schema'

/**
 * Demo collections over the real Waimers catalogue so the collections screen
 * and the storefront have something to show. Every row is recognised by its
 * handle, so `--clean` removes exactly these and nothing a merchant added.
 */

type DemoCollection = {
  handle: string
  title: string
  seoDescription: string
  kind: 'manual' | 'automatic'
  rules?: CollectionRules
  /** Manual collections pick their members by a title match. */
  match?: string[]
  sortOrder?: 'manual' | 'title_asc' | 'price_asc' | 'created_desc'
}

/* The Waimers catalogue types everything "Mouse Pad", so the demo leans on
   vendor, title and price, which actually vary, rather than on product type. */
const COLLECTIONS: DemoCollection[] = [
  {
    handle: 'mousepads',
    title: 'Mousepads',
    seoDescription: 'Control, speed and hybrid pads for every grip.',
    kind: 'automatic',
    rules: { match: 'all', conditions: [{ field: 'type', op: 'contains', value: 'pad' }] },
    sortOrder: 'title_asc',
  },
  {
    handle: 'glasspads',
    title: 'Glasspads',
    seoDescription: 'Glass surfaces for the fastest possible glide.',
    kind: 'automatic',
    rules: { match: 'all', conditions: [{ field: 'title', op: 'contains', value: 'glasspad' }] },
    sortOrder: 'title_asc',
  },
  {
    handle: 'pulsar',
    title: 'Pulsar',
    seoDescription: 'Everything from Pulsar.',
    kind: 'automatic',
    rules: { match: 'all', conditions: [{ field: 'vendor', op: 'eq', value: 'Pulsar' }] },
    sortOrder: 'title_asc',
  },
  {
    handle: 'talongames',
    title: 'Talongames',
    seoDescription: 'The full Talongames range.',
    kind: 'automatic',
    rules: { match: 'all', conditions: [{ field: 'vendor', op: 'eq', value: 'TALONGAMES' }] },
  },
  {
    handle: 'premium',
    title: 'Premium picks',
    seoDescription: 'Everything above five thousand rupees.',
    kind: 'automatic',
    rules: { match: 'all', conditions: [{ field: 'price', op: 'gt', value: '5000' }] },
    sortOrder: 'price_asc',
  },
  {
    handle: 'best-sellers',
    title: 'Best sellers',
    seoDescription: 'The pads that move fastest.',
    kind: 'manual',
    match: ['maboroshi', 'shion', 'aquila', 'hyperion'],
    sortOrder: 'manual',
  },
]

/** Handles this seed has ever used, so a rerun or `--clean` clears earlier shapes too. */
const HANDLES = [...new Set([...COLLECTIONS.map((c) => c.handle), 'keyboards', 'mice'])]

/** Mirrors `evaluateRules` in @commerce/core for the shapes this seed uses. */
function matchesDemoRule(
  p: { title: string; productType: string | null; vendor: string | null; tags: string[] },
  price: number | null,
  rules: CollectionRules,
): boolean {
  return rules.conditions.every((c) => {
    const text = (v: string | null) => (v ?? '').toLowerCase()
    const value = c.value.toLowerCase()
    if (c.field === 'type') return text(p.productType).includes(value)
    if (c.field === 'title') return text(p.title).includes(value)
    if (c.field === 'vendor')
      return c.op === 'eq' ? text(p.vendor) === value : text(p.vendor).includes(value)
    if (c.field === 'price') {
      const target = Math.round(Number(c.value) * 100)
      return price !== null && (c.op === 'gt' ? price > target : price < target)
    }
    return false
  })
}

export async function seedDemoCollections(ownerUrl: string, opts: { clean?: boolean } = {}) {
  const db = createDb(ownerUrl)
  try {
    const [s] = await db.select().from(store).where(eq(store.slug, 'waimers'))
    if (!s) throw new Error('seed the store first (bun run db:seed)')
    const storeId = s.id

    const existing = await db
      .select({ id: collection.id })
      .from(collection)
      .where(inArray(collection.handle, HANDLES))
    if (existing.length > 0) {
      await db.delete(collectionProduct).where(
        inArray(
          collectionProduct.collectionId,
          existing.map((e) => e.id),
        ),
      )
      await db.delete(collection).where(inArray(collection.handle, HANDLES))
    }
    if (opts.clean) {
      console.log(`demo: removed ${existing.length} collections`)
      return
    }

    const products = await db
      .select({
        id: product.id,
        title: product.title,
        productType: product.productType,
        vendor: product.vendor,
        tags: product.tags,
      })
      .from(product)
      .where(eq(product.status, 'active'))
      .orderBy(asc(product.createdAt))
    const prices = await db
      .select({ productId: variant.productId, price: min(variant.pricePaise) })
      .from(variant)
      .where(isNull(variant.archivedAt))
      .groupBy(variant.productId)
    const priceOf = new Map(prices.map((r) => [r.productId, Number(r.price ?? 0)]))

    for (const c of COLLECTIONS) {
      const [row] = await db
        .insert(collection)
        .values({
          storeId,
          handle: c.handle,
          title: c.title,
          kind: c.kind,
          rules: c.rules ?? { match: 'all', conditions: [] },
          sortOrder: c.sortOrder ?? 'manual',
          seoDescription: c.seoDescription,
          status: 'active',
        })
        .returning({ id: collection.id })
      if (!row) continue

      const members =
        c.kind === 'automatic' && c.rules
          ? products.filter((p) =>
              matchesDemoRule(p, priceOf.get(p.id) ?? null, c.rules as CollectionRules),
            )
          : products.filter((p) => (c.match ?? []).some((m) => p.title.toLowerCase().includes(m)))

      if (members.length > 0) {
        await db.insert(collectionProduct).values(
          members.slice(0, 60).map((m, i) => ({
            storeId,
            collectionId: row.id,
            productId: m.id,
            position: i,
          })),
        )
      }
      console.log(`demo: ${c.title} (${c.kind}) with ${members.length} products`)
    }
  } finally {
    await db.$client.end()
  }
}

if ((import.meta as { main?: boolean }).main) {
  const url = process.env.DATABASE_URL_OWNER
  if (!url) throw new Error('DATABASE_URL_OWNER is required')
  await seedDemoCollections(url, { clean: process.argv.includes('--clean') })
}
