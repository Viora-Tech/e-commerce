import {
  buildMatrix,
  type InventoryReason,
  type ProductStatus,
  type ProductWrite,
  variantTitle,
} from '@commerce/core/catalog'
import { isRichTextEmpty, parseRichText, type RichTextValue } from '@commerce/richtext'
import { rupees } from '@/data/products'
import type { api } from '@/lib/api-client'

export type LoadedProduct = NonNullable<Awaited<ReturnType<typeof api.products.get>>>

export type Facets = { vendors: string[]; productTypes: string[]; tags: string[] }

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
  hsCode: string
  countryOfOrigin: string
  /** Blank uses the store rate. */
  gstRate: string
  mediaId: string | null
}

export type MediaItem = { id: string; url: string; alt: string | null; contentType: string | null }

export type ProductFormState = {
  title: string
  description: RichTextValue | null
  status: ProductStatus
  vendor: string
  productType: string
  tags: string[]
  seoTitle: string
  seoDescription: string
  /** Alternate product template; blank is the default. */
  templateSuffix: string
  handle: string
  /** Prices already carry tax; drives the "Tax included" choice on the form. */
  taxIncluded: boolean
  /** Highlights the product in the storefront's featured section. */
  featured: boolean
  /** `yyyy-mm-dd` bounds for the compare-at price; empty means no bound. */
  saleStartsAt: string
  saleEndsAt: string
  preorderEnabled: boolean
  /** `yyyy-mm-dd`; blank means "ships in N days" (or nothing) drives the ship date instead. */
  preorderShipDate: string
  /** Blank text field; parsed to an int or null. */
  preorderShipsInDays: string
  preorderLimit: string
  preorderButtonLabel: string
  preorderPaymentMode: 'full' | 'fixed' | 'percentage'
  preorderDeposit: string
  preorderDepositPercent: string
  preorderHideFromCollectionsUntilLaunch: boolean
  /** `yyyy-mm-ddThh:mm`, Asia/Kolkata as typed; blank means always on sale. */
  launchAt: string
  options: OptionRow[]
  variants: VariantRow[]
  /** Gallery in display order; the first item is the cover. */
  media: MediaItem[]
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
    hsCode: template?.hsCode ?? '',
    countryOfOrigin: template?.countryOfOrigin ?? '',
    gstRate: template?.gstRate ?? '',
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
    templateSuffix: '',
    handle: '',
    taxIncluded: true,
    featured: false,
    saleStartsAt: '',
    saleEndsAt: '',
    preorderEnabled: false,
    preorderShipDate: '',
    preorderShipsInDays: '',
    preorderLimit: '',
    preorderButtonLabel: 'Pre-order',
    preorderPaymentMode: 'full',
    preorderDeposit: '',
    preorderDepositPercent: '',
    preorderHideFromCollectionsUntilLaunch: false,
    launchAt: '',
    options: [],
    variants: [emptyVariant([])],
    media: [],
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
    templateSuffix: p.templateSuffix ?? '',
    handle: p.handle,
    taxIncluded: p.taxIncluded,
    featured: p.featured,
    saleStartsAt: toDateField(p.saleStartsAt),
    saleEndsAt: toDateField(p.saleEndsAt),
    preorderEnabled: p.preorderEnabled,
    preorderShipDate: toDateField(p.preorderShipDate),
    preorderShipsInDays: p.preorderShipsInDays == null ? '' : String(p.preorderShipsInDays),
    preorderLimit: p.preorderLimit == null ? '' : String(p.preorderLimit),
    preorderButtonLabel: p.preorderButtonLabel || 'Pre-order',
    preorderPaymentMode: p.preorderPaymentMode,
    preorderDeposit: rupees.toField(p.preorderDepositPaise),
    preorderDepositPercent:
      p.preorderDepositPercent == null ? '' : String(p.preorderDepositPercent),
    preorderHideFromCollectionsUntilLaunch: p.preorderHideFromCollectionsUntilLaunch,
    launchAt: toDateTimeField(p.launchAt),
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
      hsCode: v.hsCode ?? '',
      countryOfOrigin: v.countryOfOrigin ?? '',
      gstRate: v.gstRatePercent == null ? '' : String(v.gstRatePercent),
      mediaId: v.mediaId,
    })),
    media: p.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt, contentType: i.contentType })),
    inventoryReason: 'correction',
  }
}

/**
 * Comparable form snapshot. The editor reports an empty document where the
 * form starts at `null`, so an untouched description must not read as an edit.
 */
export function snapshot(form: ProductFormState): string {
  return JSON.stringify({
    ...form,
    description: form.description && isRichTextEmpty(form.description) ? null : form.description,
  })
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

/** Timestamp to the `yyyy-mm-dd` a date input wants, in the browser's zone. */
function toDateField(value: Date | string | null): string {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fromDateField(value: string): Date | null {
  if (!value.trim()) return null
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** `yyyy-mm-ddThh:mm` for a `datetime-local` input, in the browser's zone (the admin runs in IST). */
function toDateTimeField(value: Date | string | null): string {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDateTimeField(value: string): Date | null {
  if (!value.trim()) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

const intOrNull = (text: string): number | null => {
  const n = Number(text)
  return text.trim() === '' || !Number.isInteger(n) ? null : n
}

export function toWrite(form: ProductFormState): ProductWrite {
  return {
    title: form.title.trim(),
    handle: form.handle.trim() || undefined,
    description: form.description && isRichTextEmpty(form.description) ? null : form.description,
    vendor: form.vendor.trim() || null,
    productType: form.productType.trim() || null,
    tags: form.tags,
    seoTitle: form.seoTitle.trim() || null,
    seoDescription: form.seoDescription.trim() || null,
    templateSuffix: form.templateSuffix || null,
    status: form.status,
    taxIncluded: form.taxIncluded,
    featured: form.featured,
    saleStartsAt: fromDateField(form.saleStartsAt),
    saleEndsAt: fromDateField(form.saleEndsAt),
    preorderEnabled: form.preorderEnabled,
    preorderShipDate: fromDateField(form.preorderShipDate),
    preorderShipsInDays: intOrNull(form.preorderShipsInDays),
    preorderLimit: intOrNull(form.preorderLimit),
    preorderButtonLabel: form.preorderButtonLabel.trim() || 'Pre-order',
    preorderPaymentMode: form.preorderPaymentMode,
    preorderDepositPaise: rupees.toPaise(form.preorderDeposit),
    preorderDepositPercent: intOrNull(form.preorderDepositPercent),
    preorderHideFromCollectionsUntilLaunch: form.preorderHideFromCollectionsUntilLaunch,
    launchAt: fromDateTimeField(form.launchAt),
    inventoryReason: form.inventoryReason,
    mediaIds: form.media.map((m) => m.id),
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
      hsCode: v.hsCode.trim() || null,
      countryOfOrigin: v.countryOfOrigin.trim() || null,
      gstRatePercent: v.gstRate.trim() === '' ? null : Number(v.gstRate),
      onHand: v.trackInventory ? (intOrNull(v.quantity) ?? 0) : undefined,
      mediaId: v.mediaId,
    })),
  }
}

/** Client-side checks that give an inline message before the round trip. */
export function formErrors(form: ProductFormState): {
  title?: string
  variants?: string
  preorderDeposit?: string
} {
  const errors: { title?: string; variants?: string; preorderDeposit?: string } = {}
  if (!form.title.trim()) errors.title = 'required'
  const bad = form.variants.find((v) => rupees.toPaise(v.price) == null)
  if (bad) errors.variants = `Price is missing for ${variantTitle(bad.optionValues)}`
  if (form.preorderEnabled) {
    if (form.preorderPaymentMode === 'fixed') {
      const deposit = rupees.toPaise(form.preorderDeposit)
      const lowestPrice = Math.min(
        ...form.variants.map((v) => rupees.toPaise(v.price) ?? Number.POSITIVE_INFINITY),
      )
      if (deposit == null) errors.preorderDeposit = 'Enter a deposit amount'
      else if (Number.isFinite(lowestPrice) && deposit >= lowestPrice) {
        errors.preorderDeposit = 'The deposit must be less than the price'
      }
    }
    if (form.preorderPaymentMode === 'percentage') {
      const pct = Number(form.preorderDepositPercent)
      if (!Number.isInteger(pct) || pct < 1 || pct > 99) {
        errors.preorderDeposit = 'Enter a percentage between 1 and 99'
      }
    }
  }
  return errors
}

/** Percent margin and profit for the pricing card; null when cost or price is missing. */
export function margin(price: string, cost: string): { pct: number; profitPaise: number } | null {
  const p = rupees.toPaise(price)
  const c = rupees.toPaise(cost)
  if (p == null || c == null || p === 0) return null
  return { pct: Math.round(((p - c) / p) * 1000) / 10, profitPaise: p - c }
}
