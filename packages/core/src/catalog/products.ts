import type { StoreTx } from '@commerce/db'
import {
  cartLine,
  collectionProduct,
  inventoryAdjustment,
  inventoryLevel,
  newId,
  orderLine,
  product,
  productMedia,
  productOption,
  productOptionValue,
  purchaseOrderLine,
  transferLine,
  variant,
  variantOptionValue,
} from '@commerce/db'
import { and, eq, inArray, isNull, type SQL, sql } from 'drizzle-orm'
import { CommerceError } from '../errors'
import { adjustStock, setStock } from '../inventory/levels'
import { setProductMedia } from '../media/service'
import { onHandleChange } from '../redirects/handle-change'
import { mediaInStore, variantMediaIds, withKnownMedia } from '../store-scope'
import { noteProductEvent, noteProductsChanged } from './changes'
import { preorderErrors, productRow, variantRow } from './product-rows'
import type { InventoryReason, ProductWrite } from './schemas'
import { slugify } from './slug'
import { loadVariantMedia, nextVariantMedia, writeVariantMedia } from './variant-media'
import {
  DEFAULT_VARIANT_TITLE,
  diffVariants,
  type OptionInput,
  type VariantInput,
  variantErrors,
  variantTitle,
} from './variants'

export class InvalidProduct extends CommerceError {
  readonly errors: string[]
  constructor(errors: string[]) {
    super('INVALID_PRODUCT', errors.join('; '))
    this.errors = errors
  }
}

export { slugify }

/** First free handle: `slug`, then `slug-2`, `slug-3`… ignoring `exceptId` (the product being edited). */
export async function uniqueHandle(tx: StoreTx, base: string, exceptId?: string): Promise<string> {
  const slug = slugify(base) || 'product'
  const rows = await tx
    .select({ id: product.id, handle: product.handle })
    .from(product)
    .where(sql`${product.handle} = ${slug} OR ${product.handle} LIKE ${`${slug}-%`}`)
  const taken = new Set(rows.filter((r) => r.id !== exceptId).map((r) => r.handle))
  if (!taken.has(slug)) return slug
  for (let n = 2; ; n++) {
    const candidate = `${slug}-${n}`
    if (!taken.has(candidate)) return candidate
  }
}

/** Product writes from an import (CSV, Shopify) start no automations (`noteProductEvent`). */
export type ProductWriteOptions = { imported?: boolean | undefined }

export async function createProduct(
  tx: StoreTx,
  storeId: string,
  write: ProductWrite,
  opts: ProductWriteOptions = {},
) {
  const errors = [...variantErrors(write.options, write.variants), ...preorderErrors(write)]
  if (errors.length) throw new InvalidProduct(errors)
  const id = newId()
  const handle = await uniqueHandle(tx, write.handle ?? write.title)
  await tx.insert(product).values({ id, storeId, handle, ...productRow(write) })
  // A variant image must be this store's media; a foreign or stale id is dropped.
  const known = await mediaInStore(tx, variantMediaIds(write.variants))
  await setOptionsAndVariants(
    tx,
    storeId,
    id,
    write.options,
    withKnownMedia(write.variants, known),
    write.inventoryReason,
  )
  if (write.mediaIds) await setProductMedia(tx, storeId, id, write.mediaIds)
  await noteProductsChanged(tx, [id], storeId)
  if (!opts.imported) await noteProductEvent(tx, storeId, 'product.created', [id])
  return id
}

export async function updateProduct(
  tx: StoreTx,
  storeId: string,
  id: string,
  write: ProductWrite,
  opts: ProductWriteOptions = {},
) {
  const errors = [...variantErrors(write.options, write.variants), ...preorderErrors(write)]
  if (errors.length) throw new InvalidProduct(errors)
  const [existing] = await tx
    .select({ id: product.id, handle: product.handle })
    .from(product)
    .where(eq(product.id, id))
  if (!existing) throw new CommerceError('NOT_FOUND', `Product ${id} not found`, { storeId })
  const handle = write.handle ? await uniqueHandle(tx, write.handle, id) : undefined
  await tx
    .update(product)
    .set({ ...productRow(write), ...(handle ? { handle } : {}) })
    .where(eq(product.id, id))
  await onHandleChange(tx, storeId, 'product', existing.handle, handle)
  // A variant image must be this store's media; a foreign or stale id is dropped.
  const known = await mediaInStore(tx, variantMediaIds(write.variants))
  await setOptionsAndVariants(
    tx,
    storeId,
    id,
    write.options,
    withKnownMedia(write.variants, known),
    write.inventoryReason,
  )
  if (write.mediaIds) await setProductMedia(tx, storeId, id, write.mediaIds)
  await noteProductsChanged(tx, [id], storeId)
  if (!opts.imported) await noteProductEvent(tx, storeId, 'product.updated', [id])
  return id
}

/**
 * Reconcile options, values and the variant matrix. Variants that disappear
 * are archived when an order or cart still points at them, deleted otherwise.
 */
export async function setOptionsAndVariants(
  tx: StoreTx,
  storeId: string,
  productId: string,
  options: OptionInput[],
  variants: VariantInput[],
  reason: InventoryReason = 'correction',
) {
  const valueIds = await syncOptions(tx, storeId, productId, options)

  const existing = await tx
    .select({ id: variant.id, title: variant.title, archivedAt: variant.archivedAt })
    .from(variant)
    .where(eq(variant.productId, productId))
  const diff = diffVariants(existing, variants)
  // Each variant's current image list, so a write that sends only `mediaId` keeps the rest.
  const images = await loadVariantMedia(
    tx,
    existing.map((e) => e.id),
  )

  const link = async (variantId: string, input: VariantInput) => {
    await tx.delete(variantOptionValue).where(eq(variantOptionValue.variantId, variantId))
    const rows = input.optionValues.map((value, i) => {
      const optionValueId = valueIds[i]?.get(value.trim().toLowerCase())
      if (!optionValueId) throw new InvalidProduct([`Unknown value "${value}"`])
      return { id: newId(), storeId, variantId, optionValueId }
    })
    if (rows.length) await tx.insert(variantOptionValue).values(rows)
  }

  let position = 0
  for (const input of variants) {
    const title = variantTitle(input.optionValues)
    const upd =
      diff.update.find((u) => u.input === input) ?? diff.revive.find((u) => u.input === input)
    if (upd) {
      await tx
        .update(variant)
        .set({ ...variantRow(input), position: position++, archivedAt: null })
        .where(eq(variant.id, upd.id))
      await link(upd.id, input)
      const current = images.get(upd.id) ?? []
      await writeVariantMedia(tx, storeId, upd.id, nextVariantMedia(input, current), current)
      if (input.onHand !== undefined) {
        await setOnHand(tx, storeId, upd.id, input.onHand, reason)
      }
      continue
    }
    const id = newId()
    await tx.insert(variant).values({
      id,
      storeId,
      productId,
      ...variantRow(input),
      title,
      position: position++,
    })
    await tx.insert(inventoryLevel).values({ id: newId(), storeId, variantId: id, onHand: 0 })
    await link(id, input)
    await writeVariantMedia(tx, storeId, id, nextVariantMedia(input, []), [])
    if (input.onHand) await setOnHand(tx, storeId, id, input.onHand, 'received')
  }

  if (diff.remove.length)
    await removeVariants(
      tx,
      diff.remove.map((r) => r.id),
    )
  await pruneOptionValues(tx, productId)
}

/** Options and values matched by id, then by (case-insensitive) name/value. Returns value-id lookups per option index. */
async function syncOptions(
  tx: StoreTx,
  storeId: string,
  productId: string,
  options: OptionInput[],
): Promise<Map<string, string>[]> {
  const existingOptions = await tx
    .select()
    .from(productOption)
    .where(eq(productOption.productId, productId))
  const existingValues = existingOptions.length
    ? await tx
        .select()
        .from(productOptionValue)
        .where(
          inArray(
            productOptionValue.optionId,
            existingOptions.map((o) => o.id),
          ),
        )
    : []
  const keepOptions = new Set<string>()
  const keepValues = new Set<string>()
  const lookups: Map<string, string>[] = []

  for (const [pos, o] of options.entries()) {
    const name = o.name.trim()
    const match =
      existingOptions.find((e) => e.id === o.id && !keepOptions.has(e.id)) ??
      existingOptions.find(
        (e) => e.name.toLowerCase() === name.toLowerCase() && !keepOptions.has(e.id),
      )
    const optionId = match?.id ?? newId()
    keepOptions.add(optionId)
    if (match) {
      await tx
        .update(productOption)
        .set({ name, position: pos })
        .where(eq(productOption.id, optionId))
    } else {
      await tx
        .insert(productOption)
        .values({ id: optionId, storeId, productId, name, position: pos })
    }
    const lookup = new Map<string, string>()
    for (const [vpos, v] of o.values.entries()) {
      const value = v.value.trim()
      const vm =
        existingValues.find((e) => e.id === v.id && !keepValues.has(e.id)) ??
        existingValues.find(
          (e) =>
            e.optionId === optionId &&
            e.value.toLowerCase() === value.toLowerCase() &&
            !keepValues.has(e.id),
        )
      const valueId = vm?.id ?? newId()
      keepValues.add(valueId)
      if (vm) {
        await tx
          .update(productOptionValue)
          .set({ value, position: vpos, optionId })
          .where(eq(productOptionValue.id, valueId))
      } else {
        await tx
          .insert(productOptionValue)
          .values({ id: valueId, storeId, optionId, value, position: vpos })
      }
      lookup.set(value.toLowerCase(), valueId)
    }
    lookups.push(lookup)
  }
  return lookups
}

/** Drop option values (and options) nothing references any more. Archived variants keep their title only. */
async function pruneOptionValues(tx: StoreTx, productId: string) {
  const options = await tx
    .select({ id: productOption.id })
    .from(productOption)
    .where(eq(productOption.productId, productId))
  if (!options.length) return
  const optionIds = options.map((o) => o.id)
  const values = await tx
    .select({ id: productOptionValue.id, optionId: productOptionValue.optionId })
    .from(productOptionValue)
    .where(inArray(productOptionValue.optionId, optionIds))
  const used = new Set(
    (
      await tx
        .select({ id: variantOptionValue.optionValueId })
        .from(variantOptionValue)
        .innerJoin(variant, eq(variant.id, variantOptionValue.variantId))
        .where(and(eq(variant.productId, productId), isNull(variant.archivedAt)))
    ).map((r) => r.id),
  )
  const orphanValues = values.filter((v) => !used.has(v.id)).map((v) => v.id)
  if (orphanValues.length) {
    await tx
      .delete(variantOptionValue)
      .where(inArray(variantOptionValue.optionValueId, orphanValues))
    await tx.delete(productOptionValue).where(inArray(productOptionValue.id, orphanValues))
  }
  const liveOptions = new Set(values.filter((v) => used.has(v.id)).map((v) => v.optionId))
  const orphanOptions = optionIds.filter((id) => !liveOptions.has(id))
  if (orphanOptions.length) {
    await tx.delete(productOption).where(inArray(productOption.id, orphanOptions))
  }
}

/** Variants that sit on a purchase order or a transfer; those lines must keep their variant. */
async function stockDocumentVariants(tx: StoreTx, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const [po, transfers] = await Promise.all([
    tx
      .select({ id: purchaseOrderLine.variantId })
      .from(purchaseOrderLine)
      .where(inArray(purchaseOrderLine.variantId, ids)),
    tx
      .select({ id: transferLine.variantId })
      .from(transferLine)
      .where(inArray(transferLine.variantId, ids)),
  ])
  return new Set([...po, ...transfers].map((r) => r.id))
}

/**
 * "Notify me" signups (back-in-stock plugin) for variants about to be hard-deleted. Raw SQL
 * because core does not import plugin schemas; the table always exists (core migration 0060).
 */
async function deleteBackInStockSignups(tx: StoreTx, where: SQL) {
  await tx.execute(sql`delete from back_in_stock_signup where ${where}`)
}

/** Deletes variants, or archives the ones an order, cart or stock document still points at. */
export async function removeVariants(tx: StoreTx, ids: string[]) {
  const referenced = new Set([
    ...(
      await tx
        .select({ id: orderLine.variantId })
        .from(orderLine)
        .where(inArray(orderLine.variantId, ids))
    ).map((r) => r.id),
    ...(
      await tx
        .select({ id: cartLine.variantId })
        .from(cartLine)
        .where(inArray(cartLine.variantId, ids))
    ).map((r) => r.id),
    ...(await stockDocumentVariants(tx, ids)),
  ])
  const archive = ids.filter((id) => referenced.has(id))
  const del = ids.filter((id) => !referenced.has(id))
  if (archive.length) {
    await tx.update(variant).set({ archivedAt: new Date() }).where(inArray(variant.id, archive))
    await tx.delete(variantOptionValue).where(inArray(variantOptionValue.variantId, archive))
  }
  if (del.length) {
    await deleteBackInStockSignups(tx, sql`variant_id in (${sql.join(del, sql`, `)})`)
    await tx.delete(variantOptionValue).where(inArray(variantOptionValue.variantId, del))
    await tx.delete(inventoryAdjustment).where(inArray(inventoryAdjustment.variantId, del))
    await tx.delete(inventoryLevel).where(inArray(inventoryLevel.variantId, del))
    await tx.delete(variant).where(inArray(variant.id, del))
  }
}

/** Set an absolute on-hand count at the default location, recording the delta. */
export async function setOnHand(
  tx: StoreTx,
  storeId: string,
  variantId: string,
  onHand: number,
  reason: InventoryReason,
  note?: string,
) {
  await setStock(tx, { storeId, variantId, onHand, reason, note })
}

/** Change on-hand stock at the default location and log why. */
export async function adjustInventory(
  tx: StoreTx,
  storeId: string,
  variantId: string,
  delta: number,
  reason: InventoryReason,
  note?: string,
) {
  if (delta === 0) return
  await adjustStock(tx, { storeId, variantId, delta, reason, note })
}

/**
 * Delete when nothing has ever been ordered or carted; otherwise archive so
 * the order history keeps its lines. Returns what happened.
 */
export async function deleteProduct(
  tx: StoreTx,
  productId: string,
): Promise<'deleted' | 'archived'> {
  const variants = await tx
    .select({ id: variant.id })
    .from(variant)
    .where(eq(variant.productId, productId))
  const ids = variants.map((v) => v.id)
  const referenced = ids.length
    ? (
        await tx
          .select({ n: sql<number>`count(*)` })
          .from(orderLine)
          .where(inArray(orderLine.variantId, ids))
      )[0]?.n
    : 0
  const carted = ids.length
    ? (
        await tx
          .select({ n: sql<number>`count(*)` })
          .from(cartLine)
          .where(inArray(cartLine.variantId, ids))
      )[0]?.n
    : 0
  const onStockDocuments = (await stockDocumentVariants(tx, ids)).size
  // Reviews (Reviews app, imported from Judge.me too) would go with the product (their foreign
  // key cascades), so a reviewed product is archived instead and keeps them (schema review
  // 2026-10-27). Raw SQL: core does not import plugin schemas; the table always exists.
  const [reviewed] = await tx.execute<{ n: number }>(
    sql`select count(*)::int as n from review where product_id = ${productId}`,
  )
  if (
    Number(referenced) > 0 ||
    Number(carted) > 0 ||
    onStockDocuments > 0 ||
    Number(reviewed?.n ?? 0) > 0
  ) {
    await tx
      .update(product)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(product.id, productId))
    await tx.update(variant).set({ archivedAt: new Date() }).where(eq(variant.productId, productId))
    await noteProductsChanged(tx, [productId])
    return 'archived'
  }
  // Rows that only point at the product and mean nothing once it is gone. Left in place, their
  // foreign keys make the final delete fail (a product in any collection could not be deleted).
  await tx.delete(collectionProduct).where(eq(collectionProduct.productId, productId))
  await deleteBackInStockSignups(tx, sql`product_id = ${productId}`)
  if (ids.length) {
    await tx.delete(variantOptionValue).where(inArray(variantOptionValue.variantId, ids))
    await tx.delete(inventoryAdjustment).where(inArray(inventoryAdjustment.variantId, ids))
    await tx.delete(inventoryLevel).where(inArray(inventoryLevel.variantId, ids))
    await tx.delete(variant).where(inArray(variant.id, ids))
  }
  const options = await tx
    .select({ id: productOption.id })
    .from(productOption)
    .where(eq(productOption.productId, productId))
  if (options.length) {
    await tx.delete(productOptionValue).where(
      inArray(
        productOptionValue.optionId,
        options.map((o) => o.id),
      ),
    )
    await tx.delete(productOption).where(eq(productOption.productId, productId))
  }
  await tx.delete(productMedia).where(eq(productMedia.productId, productId))
  await tx.delete(product).where(eq(product.id, productId))
  await noteProductsChanged(tx, [productId])
  return 'deleted'
}

export { DEFAULT_VARIANT_TITLE }
