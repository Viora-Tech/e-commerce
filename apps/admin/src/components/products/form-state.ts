import {
  buildMatrix,
  type InventoryReason,
  type ProductStatus,
  type ProductWrite,
  variantTitle,
} from '@commerce/core/catalog'
import { parseRichText, type RichTextValue } from '@commerce/richtext'
import { rupees } from '@/data/products'
import type { api } from '@/lib/api-client'

export type LoadedProduct = NonNullable<Awaited<ReturnType<typeof api.products.get>>>

export type OptionRow = { id?: string | undefined; name: string; values: string[] }

export type VariantRow = {
  id?: string | undefined
  optionValues: string[]
  price: string
  mrp: string
  cost: string
  sku: string
  barcode: string
  taxable: boolean
  trackInventory: boolean
  quantity: string
  weight: string
  mediaId: string | null
}

export type ProductFormState = {
  title: string
  description: RichTextValue | null
  status: ProductStatus
  vendor: string
  productType: string
  tags: string[]
  seoTitle: string
  seoDescription: string
  handle: string
  options: OptionRow[]
  variants: VariantRow[]
  /** Reason recorded against every quantity change in this save. */
  inventoryReason: InventoryReason
}

export const MAX_OPTIONS = 3

export function emptyVariant(optionValues: string[], template?: VariantRow): VariantRow {
  return {
    optionValues,
    price: template?.price ?? '',
    mrp: template?.mrp ?? '',
    cost: template?.cost ?? '',
    sku: '',
    barcode: '',
    taxable: template?.taxable ?? true,
    trackInventory: template?.trackInventory ?? true,
    quantity: '0',
    weight: template?.weight ?? '',
    mediaId: null,
  }
}

export function emptyForm(): ProductFormState {
  return {
    title: '',
    description: null,
    status: 'draft',
    vendor: '',
    productType: '',
    tags: [],
    seoTitle: '',
    seoDescription: '',
    handle: '',
    options: [],
    variants: [emptyVariant([])],
    inventoryReason: 'correction',
  }
}

export function fromProduct(p: LoadedProduct): ProductFormState {
  return {
    title: p.title,
    description: parseRichText(p.description),
    status: p.status,
    vendor: p.vendor ?? '',
    productType: p.productType ?? '',
    tags: p.tags,
    seoTitle: p.seoTitle ?? '',
    seoDescription: p.seoDescription ?? '',
    handle: p.handle,
    options: p.options.map((o) => ({
      id: o.id,
      name: o.name,
      values: o.values.map((v) => v.value),
    })),
    variants: p.variants.map((v) => ({
      id: v.id,
      optionValues: v.optionValues,
      price: rupees.toField(v.pricePaise),
      mrp: rupees.toField(v.mrpPaise),
      cost: rupees.toField(v.costPaise),
      sku: v.sku ?? '',
      barcode: v.barcode ?? '',
      taxable: v.taxable,
      trackInventory: v.trackInventory,
      quantity: String(v.onHand ?? 0),
      weight: v.weightGrams == null ? '' : String(v.weightGrams),
      mediaId: v.mediaId,
    })),
    inventoryReason: 'correction',
  }
}

/**
 * Options changed: rebuild the matrix, keeping rows whose combination still
 * exists so their price, SKU and quantity survive a rename elsewhere.
 */
export function reconcileVariants(options: OptionRow[], previous: VariantRow[]): VariantRow[] {
  const byTitle = new Map(previous.map((v) => [variantTitle(v.optionValues), v]))
  const template = previous[0]
  return buildMatrix(
    options.map((o) => ({ name: o.name, values: o.values.map((value) => ({ value })) })),
  ).map((combo) => {
    const kept = byTitle.get(variantTitle(combo))
    return kept ? { ...kept, optionValues: combo } : emptyVariant(combo, template)
  })
}

const intOrNull = (text: string): number | null => {
  const n = Number(text)
  return text.trim() === '' || !Number.isInteger(n) ? null : n
}

export function toWrite(form: ProductFormState): ProductWrite {
  return {
    title: form.title.trim(),
    handle: form.handle.trim() || undefined,
    description: form.description,
    vendor: form.vendor.trim() || null,
    productType: form.productType.trim() || null,
    tags: form.tags,
    seoTitle: form.seoTitle.trim() || null,
    seoDescription: form.seoDescription.trim() || null,
    status: form.status,
    inventoryReason: form.inventoryReason,
    options: form.options.map((o) => ({
      id: o.id,
      name: o.name.trim(),
      values: o.values.map((value) => ({ value })),
    })),
    variants: form.variants.map((v) => ({
      id: v.id,
      optionValues: v.optionValues,
      pricePaise: rupees.toPaise(v.price) ?? 0,
      mrpPaise: rupees.toPaise(v.mrp),
      costPaise: rupees.toPaise(v.cost),
      sku: v.sku.trim() || null,
      barcode: v.barcode.trim() || null,
      taxable: v.taxable,
      trackInventory: v.trackInventory,
      weightGrams: intOrNull(v.weight),
      onHand: v.trackInventory ? (intOrNull(v.quantity) ?? 0) : undefined,
      mediaId: v.mediaId,
    })),
  }
}

/** Client-side checks that give an inline message before the round trip. */
export function formErrors(form: ProductFormState): { title?: string; variants?: string } {
  const errors: { title?: string; variants?: string } = {}
  if (!form.title.trim()) errors.title = 'required'
  const bad = form.variants.find((v) => rupees.toPaise(v.price) == null)
  if (bad) errors.variants = `Price is missing for ${variantTitle(bad.optionValues)}`
  return errors
}

/** Percent margin and profit for the pricing card; null when cost or price is missing. */
export function margin(price: string, cost: string): { pct: number; profitPaise: number } | null {
  const p = rupees.toPaise(price)
  const c = rupees.toPaise(cost)
  if (p == null || c == null || p === 0) return null
  return { pct: Math.round(((p - c) / p) * 1000) / 10, profitPaise: p - c }
}
