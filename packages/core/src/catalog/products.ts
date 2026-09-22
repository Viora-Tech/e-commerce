import type { StoreTx } from '@commerce/db'
import {
  cartLine,
  inventoryAdjustment,
  inventoryLevel,
  newId,
  orderLine,
  product,
  productMedia,
  productOption,
  productOptionValue,
  variant,
  variantOptionValue,
} from '@commerce/db'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { CommerceError } from '../errors'
import { adjustStock, setStock } from '../inventory/levels'
import { setProductMedia } from '../media/service'
import type { InventoryReason, ProductWrite } from './schemas'
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

/** "Talongames 幻 Maboroshi" → "talongames-maboroshi". ASCII only so the URL is typeable. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200)
}

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

type ProductFields = Omit<ProductWrite, 'options' | 'variants' | 'inventoryReason'>

function productRow(fields: ProductFields) {
  return {
    title: fields.title,
    description: fields.description ?? null,
    vendor: fields.vendor || null,
    productType: fields.productType || null,
    tags: dedupe(fields.tags ?? []),
    seoTitle: fields.seoTitle || null,
    seoDescription: fields.seoDescription || null,
    status: fields.status ?? 'draft',
    taxIncluded: fields.taxIncluded ?? true,
    featured: fields.featured ?? false,
    saleStartsAt: fields.saleStartsAt ?? null,
    saleEndsAt: fields.saleEndsAt ?? null,
    updatedAt: new Date(),
  }
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const v = raw.trim()
    const k = v.toLowerCase()
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(v)
  }
  return out
}

function variantRow(input: VariantInput) {
  return {
    title: variantTitle(input.optionValues),
    sku: input.sku || null,
    barcode: input.barcode || null,
    pricePaise: input.pricePaise,
    mrpPaise: input.mrpPaise ?? null,
    costPaise: input.costPaise ?? null,
    taxable: input.taxable ?? true,
    trackInventory: input.trackInventory ?? true,
    weightGrams: input.weightGrams ?? null,
    hsCode: input.hsCode ?? null,
    countryOfOrigin: input.countryOfOrigin ?? null,
    gstRatePercent: input.gstRatePercent ?? null,
    mediaId: input.mediaId ?? null,
  }
}

export async function createProduct(tx: StoreTx, storeId: string, write: ProductWrite) {
  const errors = variantErrors(write.options, write.variants)
  if (errors.length) throw new InvalidProduct(errors)
  const id = newId()
  const handle = await uniqueHandle(tx, write.handle ?? write.title)
  await tx.insert(product).values({ id, storeId, handle, ...productRow(write) })
  await setOptionsAndVariants(tx, storeId, id, write.options, write.variants, write.inventoryReason)
  if (write.mediaIds) await setProductMedia(tx, storeId, id, write.mediaIds)
  return id
}

export async function updateProduct(tx: StoreTx, storeId: string, id: string, write: ProductWrite) {
  const errors = variantErrors(write.options, write.variants)
  if (errors.length) throw new InvalidProduct(errors)
  const [existing] = await tx.select({ id: product.id }).from(product).where(eq(product.id, id))
  if (!existing) throw new CommerceError('NOT_FOUND', `Product ${id} not found`, { storeId })
  const handle = write.handle ? await uniqueHandle(tx, write.handle, id) : undefined
  await tx
    .update(product)
    .set({ ...productRow(write), ...(handle ? { handle } : {}) })
    .where(eq(product.id, id))
  await setOptionsAndVariants(tx, storeId, id, write.options, write.variants, write.inventoryReason)
  if (write.mediaIds) await setProductMedia(tx, storeId, id, write.mediaIds)
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

async function removeVariants(tx: StoreTx, ids: string[]) {
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
  ])
  const archive = ids.filter((id) => referenced.has(id))
  const del = ids.filter((id) => !referenced.has(id))
  if (archive.length) {
    await tx.update(variant).set({ archivedAt: new Date() }).where(inArray(variant.id, archive))
    await tx.delete(variantOptionValue).where(inArray(variantOptionValue.variantId, archive))
  }
  if (del.length) {
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
  if (Number(referenced) > 0 || Number(carted) > 0) {
    await tx
      .update(product)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(product.id, productId))
    await tx.update(variant).set({ archivedAt: new Date() }).where(eq(variant.productId, productId))
    return 'archived'
  }
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
  return 'deleted'
}

export { DEFAULT_VARIANT_TITLE }
