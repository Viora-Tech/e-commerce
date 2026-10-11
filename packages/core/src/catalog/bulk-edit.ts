/** SOURCE OF TRUTH: bulkEdit — WHAT one transactional save of many product and variant cells
 * (title, status, vendor, type, tags, price, compare-at, cost, SKU, barcode, weight, HSN, GST
 * rate, stock per location) does / WHY it validates every row before it writes any: the bulk
 * editor grid shows all errors at once and a bad row never leaves half the sheet saved.
 * Stock goes through `setStock`, so every change is logged in the inventory ledger.
 */
import type { StoreTx } from '@commerce/db'
import { inventoryLevel, location, product, variant } from '@commerce/db'
import { and, eq, inArray, isNull, notInArray } from 'drizzle-orm'
import { setStock } from '../inventory/levels'
import {
  type BulkEditError,
  type BulkEditResult,
  type BulkEditRow,
  HS_CODE_PATTERN,
} from './bulk-edit-schemas'

type ProductCells = NonNullable<BulkEditRow['product']>
type VariantCells = NonNullable<BulkEditRow['variant']>

const PRODUCT_KEYS = ['title', 'status', 'vendor', 'productType', 'tags'] as const
const VARIANT_KEYS = [
  'pricePaise',
  'mrpPaise',
  'costPaise',
  'sku',
  'barcode',
  'weightGrams',
  'hsCode',
  'gstRatePercent',
] as const

/** An emptied text cell means "no value", not an empty string. */
const blankToNull = (v: string | null | undefined) =>
  v == null || v.trim() === '' ? null : v.trim()

function normaliseProduct(p: ProductCells): ProductCells {
  const out: ProductCells = { ...p }
  if ('vendor' in p) out.vendor = blankToNull(p.vendor)
  if ('productType' in p) out.productType = blankToNull(p.productType)
  if (p.tags) out.tags = [...new Set(p.tags.map((t) => t.trim()).filter(Boolean))]
  return out
}

function normaliseVariant(v: VariantCells): VariantCells {
  const out: VariantCells = { ...v }
  if ('sku' in v) out.sku = blankToNull(v.sku)
  if ('barcode' in v) out.barcode = blankToNull(v.barcode)
  if ('hsCode' in v) out.hsCode = blankToNull(v.hsCode)
  return out
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Only the keys whose new value differs from what is stored. */
function changedKeys<T extends object>(
  keys: readonly (keyof T)[],
  patch: T,
  current: Record<string, unknown>,
): (keyof T)[] {
  return keys.filter((k) => k in patch && !same(patch[k] ?? null, current[k as string] ?? null))
}

export async function bulkEdit(
  tx: StoreTx,
  storeId: string,
  rows: BulkEditRow[],
): Promise<BulkEditResult> {
  const errors: BulkEditError[] = []
  const fail = (variantId: string, field: string, message: string) =>
    errors.push({ variantId, field, message })

  const ids = [...new Set(rows.map((r) => r.variantId))]
  if (ids.length !== rows.length) {
    const seen = new Set<string>()
    for (const r of rows) {
      if (seen.has(r.variantId)) fail(r.variantId, 'row', 'This variant is in the sheet twice')
      seen.add(r.variantId)
    }
  }

  const found = await tx
    .select({
      variantId: variant.id,
      productId: variant.productId,
      pricePaise: variant.pricePaise,
      mrpPaise: variant.mrpPaise,
      costPaise: variant.costPaise,
      sku: variant.sku,
      barcode: variant.barcode,
      weightGrams: variant.weightGrams,
      hsCode: variant.hsCode,
      gstRatePercent: variant.gstRatePercent,
      title: product.title,
      status: product.status,
      vendor: product.vendor,
      productType: product.productType,
      tags: product.tags,
    })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .where(and(inArray(variant.id, ids), isNull(variant.archivedAt)))
  const current = new Map(found.map((c) => [c.variantId, c]))

  /* Product cells repeat on every variant row of a product; they must agree. */
  const productPatch = new Map<string, { patch: ProductCells; variantId: string }>()
  const normalised = rows.map((r) => ({
    ...r,
    product: r.product ? normaliseProduct(r.product) : undefined,
    variant: r.variant ? normaliseVariant(r.variant) : undefined,
  }))
  for (const r of normalised) {
    const cur = current.get(r.variantId)
    if (!cur) {
      fail(r.variantId, 'row', 'Variant not found')
      continue
    }
    if (!r.product) continue
    const seen = productPatch.get(cur.productId)
    if (!seen) {
      productPatch.set(cur.productId, { patch: r.product, variantId: r.variantId })
      continue
    }
    for (const key of PRODUCT_KEYS) {
      if (key in r.product && key in seen.patch && !same(r.product[key], seen.patch[key])) {
        fail(r.variantId, key, 'Differs from another row of the same product')
      } else if (key in r.product && !(key in seen.patch)) {
        ;(seen.patch as Record<string, unknown>)[key] = r.product[key]
      }
    }
  }

  /* Final values per variant, for the rules that look at two cells at once. */
  const skuGroups = new Map<string, string[]>()
  const patchedSku = new Map<string, string>()
  for (const r of normalised) {
    const cur = current.get(r.variantId)
    if (!cur) continue
    const price = r.variant?.pricePaise ?? cur.pricePaise
    const mrp = r.variant && 'mrpPaise' in r.variant ? r.variant.mrpPaise : cur.mrpPaise
    if (mrp != null && mrp < price) {
      fail(r.variantId, 'mrpPaise', 'Compare-at price must not be below the price')
    }
    const hs = r.variant && 'hsCode' in r.variant ? r.variant.hsCode : undefined
    if (hs && !HS_CODE_PATTERN.test(hs)) fail(r.variantId, 'hsCode', 'HSN must be 4 to 8 digits')
    const patched = r.variant && 'sku' in r.variant
    const sku = patched ? r.variant?.sku : cur.sku
    if (patched && sku) patchedSku.set(r.variantId, sku)
    if (sku)
      skuGroups.set(sku.toLowerCase(), [...(skuGroups.get(sku.toLowerCase()) ?? []), r.variantId])
  }
  for (const [variantId, sku] of patchedSku) {
    if ((skuGroups.get(sku.toLowerCase())?.length ?? 0) > 1) {
      fail(variantId, 'sku', `SKU ${sku} is used twice in this sheet`)
    }
  }
  if (patchedSku.size > 0) {
    const byLower = new Map([...patchedSku].map(([id, sku]) => [sku.toLowerCase(), id]))
    const taken = await tx
      .select({ sku: variant.sku })
      .from(variant)
      .where(
        and(
          isNull(variant.archivedAt),
          notInArray(variant.id, ids),
          inArray(variant.sku, [...patchedSku.values()]),
        ),
      )
    for (const t of taken) {
      const owner = t.sku ? byLower.get(t.sku.toLowerCase()) : undefined
      if (owner) fail(owner, 'sku', `SKU ${t.sku} is already on another variant`)
    }
  }

  /* Locations named in a stock cell must be this store's. */
  const locationIds = [...new Set(normalised.flatMap((r) => Object.keys(r.stock ?? {})))]
  const knownLocations = new Set(
    locationIds.length
      ? (
          await tx
            .select({ id: location.id })
            .from(location)
            .where(inArray(location.id, locationIds))
        ).map((l) => l.id)
      : [],
  )
  for (const r of normalised) {
    for (const loc of Object.keys(r.stock ?? {})) {
      if (!knownLocations.has(loc)) fail(r.variantId, `stock:${loc}`, 'Unknown location')
    }
  }

  if (errors.length > 0) return { ok: false, errors }

  const levels = await tx
    .select({
      variantId: inventoryLevel.variantId,
      locationId: inventoryLevel.locationId,
      onHand: inventoryLevel.onHand,
    })
    .from(inventoryLevel)
    .where(inArray(inventoryLevel.variantId, ids))
  const onHand = new Map(levels.map((l) => [`${l.variantId}:${l.locationId}`, l.onHand]))

  const undo = new Map<string, BulkEditRow>()
  const undoRow = (variantId: string) => {
    const row = undo.get(variantId) ?? { variantId }
    undo.set(variantId, row)
    return row
  }
  let updatedProducts = 0
  let updatedVariants = 0
  let stockChanges = 0

  for (const [productId, { patch, variantId }] of productPatch) {
    const cur = current.get(variantId)
    if (!cur) continue
    const keys = changedKeys(PRODUCT_KEYS, patch, cur)
    if (keys.length === 0) continue
    const set = Object.fromEntries(keys.map((k) => [k, patch[k]]))
    await tx
      .update(product)
      .set({ ...set, updatedAt: new Date() })
      .where(eq(product.id, productId))
    updatedProducts += 1
    undoRow(variantId).product = Object.fromEntries(keys.map((k) => [k, cur[k]])) as ProductCells
  }

  for (const r of normalised) {
    const cur = current.get(r.variantId)
    if (!cur) continue
    if (r.variant) {
      const keys = changedKeys(VARIANT_KEYS, r.variant, cur)
      if (keys.length > 0) {
        await tx
          .update(variant)
          .set(Object.fromEntries(keys.map((k) => [k, r.variant?.[k]])))
          .where(eq(variant.id, r.variantId))
        updatedVariants += 1
        undoRow(r.variantId).variant = Object.fromEntries(
          keys.map((k) => [k, cur[k]]),
        ) as VariantCells
      }
    }
    for (const [locationId, count] of Object.entries(r.stock ?? {})) {
      const before = onHand.get(`${r.variantId}:${locationId}`) ?? 0
      if (before === count) continue
      await setStock(tx, {
        storeId,
        variantId: r.variantId,
        locationId,
        onHand: count,
        reason: 'correction',
        note: 'Bulk edit',
      })
      stockChanges += 1
      const row = undoRow(r.variantId)
      row.stock = { ...row.stock, [locationId]: before }
    }
  }

  return { ok: true, updatedProducts, updatedVariants, stockChanges, undo: [...undo.values()] }
}
