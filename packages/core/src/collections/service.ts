import { collection, collectionProduct, newId, product, type StoreTx, variant } from '@commerce/db'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { slugify } from '../catalog/products'
import { type CollectionRules, type RuleProduct, selectMembers } from './rules'
import { type CollectionWrite, InvalidCollection } from './schemas'

/** First free handle: `slug`, then `slug-2`… ignoring the collection being edited. */
export async function uniqueCollectionHandle(
  tx: StoreTx,
  base: string,
  exceptId?: string,
): Promise<string> {
  const slug = slugify(base) || 'collection'
  const rows = await tx
    .select({ id: collection.id, handle: collection.handle })
    .from(collection)
    .where(sql`${collection.handle} = ${slug} OR ${collection.handle} LIKE ${`${slug}-%`}`)
  const taken = new Set(rows.filter((r) => r.id !== exceptId).map((r) => r.handle))
  if (!taken.has(slug)) return slug
  for (let n = 2; ; n++) {
    const candidate = `${slug}-${n}`
    if (!taken.has(candidate)) return candidate
  }
}

/** Every product with the facts a rule reads, cheapest variant first. */
export async function ruleProducts(
  tx: StoreTx,
): Promise<(RuleProduct & { id: string; createdAt: Date })[]> {
  const rows = await tx
    .select({
      id: product.id,
      title: product.title,
      productType: product.productType,
      vendor: product.vendor,
      tags: product.tags,
      createdAt: product.createdAt,
      pricePaise: sql<
        number | null
      >`(select min(${variant.pricePaise}) from ${variant} where ${variant.productId} = ${product.id} and ${variant.archivedAt} is null)`,
    })
    .from(product)
    .where(eq(product.status, 'active'))
    .orderBy(asc(product.createdAt))
  return rows.map((r) => ({
    ...r,
    pricePaise: r.pricePaise === null ? null : Number(r.pricePaise),
  }))
}

async function writeMembers(
  tx: StoreTx,
  storeId: string,
  collectionId: string,
  productIds: string[],
) {
  await tx.delete(collectionProduct).where(eq(collectionProduct.collectionId, collectionId))
  if (productIds.length === 0) return
  await tx.insert(collectionProduct).values(
    productIds.map((productId, index) => ({
      id: newId(),
      storeId,
      collectionId,
      productId,
      position: index,
    })),
  )
}

/**
 * Recompute an automatic collection's membership.
 *
 * Membership is materialised rather than evaluated on read so the storefront
 * can page and sort with plain SQL; the cost is this sync, which runs whenever
 * the rules or the catalogue change.
 */
export async function syncAutomaticCollection(
  tx: StoreTx,
  storeId: string,
  collectionId: string,
): Promise<number> {
  const [row] = await tx.select().from(collection).where(eq(collection.id, collectionId))
  if (row?.kind !== 'automatic') return 0
  const products = await ruleProducts(tx)
  const members = selectMembers(products, row.rules as CollectionRules)
  await writeMembers(
    tx,
    storeId,
    collectionId,
    members.map((m) => m.id),
  )
  return members.length
}

/** Re-sync every automatic collection; called after a product is created, edited or imported. */
export async function syncAutomaticCollections(tx: StoreTx, storeId: string): Promise<void> {
  const rows = await tx
    .select({ id: collection.id, rules: collection.rules })
    .from(collection)
    .where(eq(collection.kind, 'automatic'))
  if (rows.length === 0) return
  const products = await ruleProducts(tx)
  for (const row of rows) {
    const members = selectMembers(products, row.rules as CollectionRules)
    await writeMembers(
      tx,
      storeId,
      row.id,
      members.map((m) => m.id),
    )
  }
}

/** How many products a rule set would hold, without saving it. */
export async function previewRules(tx: StoreTx, rules: CollectionRules): Promise<number> {
  const products = await ruleProducts(tx)
  return selectMembers(products, rules).length
}

function validate(write: CollectionWrite): void {
  const errors: string[] = []
  if (write.kind === 'automatic' && (write.rules?.conditions.length ?? 0) === 0) {
    errors.push('An automatic collection needs at least one condition')
  }
  if (errors.length > 0) throw new InvalidCollection(errors)
}

function collectionRow(write: CollectionWrite) {
  return {
    title: write.title,
    description: write.description ?? null,
    imageMediaId: write.imageMediaId ?? null,
    kind: write.kind,
    rules: write.rules ?? { match: 'all' as const, conditions: [] },
    sortOrder: write.sortOrder ?? 'manual',
    seoTitle: write.seoTitle || null,
    seoDescription: write.seoDescription || null,
    ...(write.templateSuffix === undefined ? {} : { templateSuffix: write.templateSuffix || null }),
    status: write.status ?? 'active',
  }
}

export async function createCollection(
  tx: StoreTx,
  storeId: string,
  write: CollectionWrite,
): Promise<string> {
  validate(write)
  const id = newId()
  const handle = await uniqueCollectionHandle(tx, write.handle ?? write.title)
  await tx.insert(collection).values({ id, storeId, handle, ...collectionRow(write) })
  if (write.kind === 'automatic') await syncAutomaticCollection(tx, storeId, id)
  else if (write.productIds) await writeMembers(tx, storeId, id, write.productIds)
  return id
}

export async function updateCollection(
  tx: StoreTx,
  storeId: string,
  id: string,
  write: CollectionWrite,
): Promise<void> {
  validate(write)
  const handle = write.handle
    ? await uniqueCollectionHandle(tx, write.handle, id)
    : (
        await tx.select({ handle: collection.handle }).from(collection).where(eq(collection.id, id))
      ).at(0)?.handle
  await tx
    .update(collection)
    .set({ ...collectionRow(write), handle, updatedAt: new Date() })
    .where(eq(collection.id, id))
  if (write.kind === 'automatic') await syncAutomaticCollection(tx, storeId, id)
  else if (write.productIds) await writeMembers(tx, storeId, id, write.productIds)
}

export async function deleteCollection(tx: StoreTx, id: string): Promise<void> {
  await tx.delete(collectionProduct).where(eq(collectionProduct.collectionId, id))
  await tx.delete(collection).where(eq(collection.id, id))
}

/** Manual reorder from the product picker. */
export async function reorderCollection(
  tx: StoreTx,
  collectionId: string,
  productIds: string[],
): Promise<void> {
  for (const [index, productId] of productIds.entries()) {
    await tx
      .update(collectionProduct)
      .set({ position: index })
      .where(
        and(
          eq(collectionProduct.collectionId, collectionId),
          eq(collectionProduct.productId, productId),
        ),
      )
  }
}

/** Collection ids a set of products belongs to, for the product form. */
export async function collectionsForProducts(
  tx: StoreTx,
  productIds: string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>()
  if (productIds.length === 0) return out
  const rows = await tx
    .select({
      productId: collectionProduct.productId,
      collectionId: collectionProduct.collectionId,
    })
    .from(collectionProduct)
    .where(inArray(collectionProduct.productId, productIds))
  for (const row of rows) {
    out.set(row.productId, [...(out.get(row.productId) ?? []), row.collectionId])
  }
  return out
}

/** Replace the manual collections a single product sits in (used by the product form). */
export async function setProductCollections(
  tx: StoreTx,
  storeId: string,
  productId: string,
  collectionIds: string[],
): Promise<void> {
  const manual = await tx
    .select({ id: collection.id })
    .from(collection)
    .where(eq(collection.kind, 'manual'))
  const manualIds = new Set(manual.map((m) => m.id))
  await tx
    .delete(collectionProduct)
    .where(
      and(
        eq(collectionProduct.productId, productId),
        inArray(collectionProduct.collectionId, [
          ...manualIds,
          '00000000-0000-0000-0000-000000000000',
        ]),
      ),
    )
  const wanted = collectionIds.filter((c) => manualIds.has(c))
  if (wanted.length === 0) return
  await tx.insert(collectionProduct).values(
    wanted.map((collectionId) => ({
      id: newId(),
      storeId,
      collectionId,
      productId,
      position: 0,
    })),
  )
}
