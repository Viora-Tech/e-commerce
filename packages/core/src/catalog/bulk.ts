/** What the product list triggers: CSV import, duplicate and bulk edits. */
import type { StoreTx } from '@commerce/db'
import {
  product,
  productOption,
  productOptionValue,
  sellableStock,
  variant,
  variantOptionValue,
} from '@commerce/db'
import { asc, eq, inArray } from 'drizzle-orm'
import { noteProductEvent, noteProductsChanged, txStoreId } from './changes'
import type { ImportProduct } from './import-csv'
import { createProduct, deleteProduct, uniqueHandle, updateProduct } from './products'
import type { ProductStatus, ProductWrite } from './schemas'

export type ImportOutcome = {
  created: number
  updated: number
  failed: { handle: string; message: string }[]
}

/** Shopify's HTML body becomes plain paragraphs; the editor takes it from there. */
function descriptionFromHtml(html: string | null): ProductWrite['description'] {
  if (!html) return null
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
  if (!text) return null
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      children: text.split(/\n{2,}/).map((paragraph) => ({
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        children: [
          {
            type: 'text',
            text: paragraph,
            format: 0,
            style: '',
            mode: 'normal',
            detail: 0,
            version: 1,
          },
        ],
      })),
    },
  } as ProductWrite['description']
}

function importToWrite(parsed: ImportProduct): ProductWrite {
  return {
    title: parsed.title,
    handle: parsed.handle,
    description: descriptionFromHtml(parsed.descriptionHtml),
    vendor: parsed.vendor,
    productType: parsed.productType,
    tags: parsed.tags,
    seoTitle: parsed.seoTitle,
    seoDescription: parsed.seoDescription,
    status: parsed.status,
    inventoryReason: 'correction',
    options: parsed.optionNames.map((name, i) => ({
      name,
      values: [...new Set(parsed.variants.map((v) => v.optionValues[i] ?? ''))]
        .filter(Boolean)
        .map((value) => ({ value })),
    })),
    variants: parsed.variants.map((v) => ({
      optionValues: v.optionValues,
      sku: v.sku,
      barcode: v.barcode,
      pricePaise: v.pricePaise,
      mrpPaise: v.mrpPaise,
      costPaise: v.costPaise,
      taxable: v.taxable,
      trackInventory: v.trackInventory,
      weightGrams: v.weightGrams,
      onHand: v.onHand,
    })),
  }
}

/**
 * Write parsed rows. A handle that already exists is updated in place, so the
 * same file can be imported twice without duplicating the catalogue.
 */
export async function importProducts(
  tx: StoreTx,
  storeId: string,
  parsed: ImportProduct[],
): Promise<ImportOutcome> {
  const handles = parsed.map((p) => p.handle)
  const existing = handles.length
    ? await tx
        .select({ id: product.id, handle: product.handle })
        .from(product)
        .where(inArray(product.handle, handles))
    : []
  const byHandle = new Map(existing.map((r) => [r.handle, r.id]))
  const outcome: ImportOutcome = { created: 0, updated: 0, failed: [] }

  for (const row of parsed) {
    const write = importToWrite(row)
    const id = byHandle.get(row.handle)
    try {
      if (id) {
        await updateProduct(tx, storeId, id, write, { imported: true })
        outcome.updated++
      } else {
        await createProduct(tx, storeId, write, { imported: true })
        outcome.created++
      }
    } catch (err) {
      outcome.failed.push({
        handle: row.handle,
        message: err instanceof Error ? err.message : 'Import failed',
      })
    }
  }
  return outcome
}

export type ExportRow = {
  handle: string
  title: string
  vendor: string | null
  productType: string | null
  tags: string[]
  status: ProductStatus
  variantTitle: string
  sku: string | null
  barcode: string | null
  pricePaise: number | null
  mrpPaise: number | null
  costPaise: number | null
  weightGrams: number | null
  onHand: number
}

/** One row per variant, products in title order. */
export async function exportRows(tx: StoreTx, productIds: string[]): Promise<ExportRow[]> {
  if (productIds.length === 0) return []
  const products = await tx
    .select()
    .from(product)
    .where(inArray(product.id, productIds))
    .orderBy(asc(product.title))
  const variants = await tx
    .select({
      productId: variant.productId,
      title: variant.title,
      sku: variant.sku,
      barcode: variant.barcode,
      pricePaise: variant.pricePaise,
      mrpPaise: variant.mrpPaise,
      costPaise: variant.costPaise,
      weightGrams: variant.weightGrams,
      onHand: sellableStock.onHand,
    })
    .from(variant)
    .leftJoin(sellableStock, eq(sellableStock.variantId, variant.id))
    .where(inArray(variant.productId, productIds))
    .orderBy(asc(variant.position))

  return products.flatMap((p) =>
    variants
      .filter((v) => v.productId === p.id)
      .map((v) => ({
        handle: p.handle,
        title: p.title,
        vendor: p.vendor,
        productType: p.productType,
        tags: p.tags,
        status: p.status,
        variantTitle: v.title,
        sku: v.sku,
        barcode: v.barcode,
        pricePaise: v.pricePaise,
        mrpPaise: v.mrpPaise,
        costPaise: v.costPaise,
        weightGrams: v.weightGrams,
        onHand: v.onHand ?? 0,
      })),
  )
}

async function optionsOf(tx: StoreTx, productId: string, variantIds: string[]) {
  const options = await tx
    .select()
    .from(productOption)
    .where(eq(productOption.productId, productId))
    .orderBy(asc(productOption.position))
  const values = options.length
    ? await tx
        .select()
        .from(productOptionValue)
        .where(
          inArray(
            productOptionValue.optionId,
            options.map((o) => o.id),
          ),
        )
        .orderBy(asc(productOptionValue.position))
    : []
  const links = variantIds.length
    ? await tx
        .select()
        .from(variantOptionValue)
        .where(inArray(variantOptionValue.variantId, variantIds))
    : []
  const valueById = new Map(values.map((v) => [v.id, v]))
  return {
    options: options.map((o) => ({
      name: o.name,
      values: values.filter((v) => v.optionId === o.id).map((v) => ({ value: v.value })),
    })),
    valuesFor: (variantId: string) =>
      options.map(
        (o) =>
          links
            .filter((l) => l.variantId === variantId)
            .map((l) => valueById.get(l.optionValueId))
            .find((val) => val?.optionId === o.id)?.value ?? '',
      ),
  }
}

/** Copy a product, its options and variants under a free handle, as a draft. */
export async function duplicateProduct(tx: StoreTx, storeId: string, id: string): Promise<string> {
  const [source] = await tx.select().from(product).where(eq(product.id, id))
  if (!source) throw new Error('Product not found')
  const variants = (
    await tx.select().from(variant).where(eq(variant.productId, id)).orderBy(asc(variant.position))
  ).filter((v) => v.archivedAt === null)
  const levels = variants.length
    ? await tx
        .select({ variantId: sellableStock.variantId, onHand: sellableStock.onHand })
        .from(sellableStock)
        .where(
          inArray(
            sellableStock.variantId,
            variants.map((v) => v.id),
          ),
        )
    : []
  const { options, valuesFor } = await optionsOf(
    tx,
    id,
    variants.map((v) => v.id),
  )
  const title = `${source.title} copy`

  return createProduct(tx, storeId, {
    title,
    handle: await uniqueHandle(tx, title),
    description: (source.description ?? null) as ProductWrite['description'],
    vendor: source.vendor,
    categoryId: source.categoryId,
    productType: source.productType,
    tags: source.tags,
    seoTitle: source.seoTitle,
    seoDescription: source.seoDescription,
    seoKeywords: source.seoKeywords,
    status: 'draft',
    inventoryReason: 'correction',
    options,
    variants: variants.map((v) => ({
      optionValues: valuesFor(v.id),
      /* SKUs and barcodes identify one physical item, so the copy starts without them. */
      sku: null,
      barcode: null,
      pricePaise: v.pricePaise,
      mrpPaise: v.mrpPaise,
      costPaise: v.costPaise,
      taxable: v.taxable,
      trackInventory: v.trackInventory,
      weightGrams: v.weightGrams,
      boxPresetId: v.boxPresetId,
      packageLengthCm: v.packageLengthCm,
      packageWidthCm: v.packageWidthCm,
      packageHeightCm: v.packageHeightCm,
      onHand: levels.find((l) => l.variantId === v.id)?.onHand ?? 0,
    })),
  })
}

export type BulkAction =
  | { kind: 'status'; status: ProductStatus }
  | { kind: 'addTag'; tag: string }
  | { kind: 'removeTag'; tag: string }
  | { kind: 'delete' }

export type BulkResult = { changed: number; deleted: number; archived: number }

/** Apply one action to many products, reporting what actually happened. */
export async function bulkUpdateProducts(
  tx: StoreTx,
  ids: string[],
  action: BulkAction,
): Promise<BulkResult> {
  const result: BulkResult = { changed: 0, deleted: 0, archived: 0 }
  if (ids.length === 0) return result

  if (action.kind === 'delete') {
    for (const id of ids) {
      const outcome = await deleteProduct(tx, id)
      if (outcome === 'deleted') result.deleted++
      else result.archived++
    }
    result.changed = ids.length
    return result
  }

  if (action.kind === 'status') {
    const rows = await tx
      .update(product)
      .set({ status: action.status, updatedAt: new Date() })
      .where(inArray(product.id, ids))
      .returning({ id: product.id })
    result.changed = rows.length
    await noteProductsChanged(
      tx,
      rows.map((r) => r.id),
    )
    await noteProductEvent(
      tx,
      await txStoreId(tx),
      'product.updated',
      rows.map((r) => r.id),
    )
    return result
  }

  const tag = action.tag.trim()
  if (!tag) return result
  const rows = await tx
    .select({ id: product.id, tags: product.tags })
    .from(product)
    .where(inArray(product.id, ids))
  const changedIds: string[] = []
  for (const row of rows) {
    const has = row.tags.some((t) => t.toLowerCase() === tag.toLowerCase())
    if (action.kind === 'addTag' && has) continue
    if (action.kind === 'removeTag' && !has) continue
    const tags =
      action.kind === 'addTag'
        ? [...row.tags, tag]
        : row.tags.filter((t) => t.toLowerCase() !== tag.toLowerCase())
    await tx.update(product).set({ tags, updatedAt: new Date() }).where(eq(product.id, row.id))
    result.changed++
    changedIds.push(row.id)
  }
  await noteProductsChanged(tx, changedIds)
  if (changedIds.length) {
    await noteProductEvent(tx, await txStoreId(tx), 'product.updated', changedIds)
  }
  return result
}
