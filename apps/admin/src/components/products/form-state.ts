import {
  buildMatrix,
  type InventoryReason,
  type ProductStatus,
  type ProductWrite,
  variantTitle,
  type WeightUnit,
} from '@commerce/core/catalog'
import { isRichTextEmpty, parseRichText, type RichTextValue } from '@commerce/richtext'
import type { productFormContent } from '@/data/product-form'
import { rupees } from '@/data/products'
import type { api } from '@/lib/api-client'
import { DEFAULT_WEIGHT_UNIT, fromGrams, toGrams } from './weight-units'

export type LoadedProduct = NonNullable<Awaited<ReturnType<typeof api.products.get>>>

/** Store-wide values the form suggests (vendors, option names and values) and the GST defaults. */
export type Facets = Awaited<ReturnType<typeof api.products.facets>>

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
  /** As typed, in `weightUnit`; saved as whole grams. */
  weight: string
  weightUnit: WeightUnit
  hsCode: string
  countryOfOrigin: string
  /** Blank uses the store rate. */
  gstRate: string
  /** One of the store's named boxes; null with dims set means a custom box, both null means the store default. */
  boxPresetId: string | null
  packageLengthCm: number | null
  packageWidthCm: number | null
  packageHeightCm: number | null
  /** The variant's images in order, ids from the product gallery; the first is its main image. */
  mediaIds: string[]
}

export type MediaItem = { id: string; url: string; alt: string | null; contentType: string | null }

export type ProductFormState = {
  title: string
  description: RichTextValue | null
  status: ProductStatus
  vendor: string
  /** Shopify Standard Product Taxonomy category id; null when unset. `productType` stays a secondary, free-text field. */
  categoryId: string | null
  productType: string
  tags: string[]
  seoTitle: string
  seoDescription: string
  /** Search keywords, primary first; they steer Write with AI, the storefront never shows them. */
  seoKeywords: string[]
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
    weightUnit: template?.weightUnit ?? DEFAULT_WEIGHT_UNIT,
    hsCode: template?.hsCode ?? '',
    countryOfOrigin: template?.countryOfOrigin ?? '',
    gstRate: template?.gstRate ?? '',
    boxPresetId: template?.boxPresetId ?? null,
    packageLengthCm: template?.packageLengthCm ?? null,
    packageWidthCm: template?.packageWidthCm ?? null,
    packageHeightCm: template?.packageHeightCm ?? null,
    mediaIds: [],
  }
}

export function emptyForm(): ProductFormState {
  return {
    title: '',
    description: null,
    status: 'draft',
    vendor: '',
    categoryId: null,
    productType: '',
    tags: [],
    seoTitle: '',
    seoDescription: '',
    seoKeywords: [],
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
    categoryId: p.categoryId ?? null,
    productType: p.productType ?? '',
    tags: p.tags,
    seoTitle: p.seoTitle ?? '',
    seoDescription: p.seoDescription ?? '',
    seoKeywords: p.seoKeywords,
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
    // A product imported without variants (Shopify "historical" items) still needs one row,
    // or the editor has nothing to show and renders a blank page.
    variants:
      p.variants.length === 0
        ? [emptyVariant([])]
        : p.variants.map((v) => ({
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
            weight: fromGrams(v.weightGrams, v.weightUnit ?? DEFAULT_WEIGHT_UNIT),
            weightUnit: v.weightUnit ?? DEFAULT_WEIGHT_UNIT,
            hsCode: v.hsCode ?? '',
            countryOfOrigin: v.countryOfOrigin ?? '',
            gstRate: v.gstRatePercent == null ? '' : String(v.gstRatePercent),
            boxPresetId: v.boxPresetId ?? null,
            packageLengthCm: v.packageLengthCm ?? null,
            packageWidthCm: v.packageWidthCm ?? null,
            packageHeightCm: v.packageHeightCm ?? null,
            mediaIds: v.mediaIds,
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

/** Options that take part in the matrix: at least one non-blank value. A half-typed option waits. */
export function matrixOptions(options: OptionRow[]): OptionRow[] {
  return options.filter((o) => o.values.some((v) => v.trim()))
}

/** Option name -> value for one row, keyed case-insensitively (blank names fall back to position). */
function valuesByName(options: OptionRow[], optionValues: string[]): Map<string, string> {
  return new Map(
    options.map((o, i) => [o.name.trim().toLowerCase() || `#${i}`, optionValues[i] ?? '']),
  )
}

/** Every option both rows know about has the same value (vacuously true with none shared). */
function agrees(a: Map<string, string>, b: Map<string, string>): boolean {
  for (const [key, value] of a) {
    if (b.has(key) && b.get(key) !== value) return false
  }
  return true
}

/**
 * Rebuilds the variant matrix after an options edit, carrying existing rows (and so their ids,
 * prices, SKUs and stock) over wherever they still fit. A row keeps its place when its
 * combination survives; otherwise it moves to the first new combination that agrees with it
 * on every option both share. So the default variant becomes the first row when the first
 * option arrives, "S" becomes "S / Red" when Colour is added, and one of "S / Red" and
 * "S / Blue" becomes "S" when Colour goes. Rows `variants` were built from `before`'s
 * matrix options; `dropped` are the rows nothing took over.
 */
export function reconcileVariants(
  after: OptionRow[],
  before: OptionRow[],
  variants: VariantRow[],
): { variants: VariantRow[]; dropped: VariantRow[] } {
  const nextOptions = matrixOptions(after)
  const prevOptions = matrixOptions(before)
  const combos = buildMatrix(
    nextOptions.map((o) => ({ name: o.name, values: o.values.map((value) => ({ value })) })),
  )
  const used = new Set<number>()
  const taken: (number | undefined)[] = combos.map((combo) => {
    const title = variantTitle(combo)
    const i = variants.findIndex((v, j) => !used.has(j) && variantTitle(v.optionValues) === title)
    if (i !== -1) used.add(i)
    return i === -1 ? undefined : i
  })
  const prevKeys = variants.map((v) => valuesByName(prevOptions, v.optionValues))
  combos.forEach((combo, c) => {
    if (taken[c] !== undefined) return
    const keys = valuesByName(nextOptions, combo)
    const i = variants.findIndex((_, j) => !used.has(j) && agrees(prevKeys[j] ?? new Map(), keys))
    if (i === -1) return
    used.add(i)
    taken[c] = i
  })
  const template = variants[0]
  return {
    variants: combos.map((combo, c) => {
      const i = taken[c]
      const kept = i === undefined ? undefined : variants[i]
      return kept ? { ...kept, optionValues: combo } : emptyVariant(combo, template)
    }),
    dropped: variants.filter((_, j) => !used.has(j)),
  }
}

/** Units on hand across rows, for the "these variants still have stock" confirmation. */
export function stockOf(rows: VariantRow[]): number {
  return rows.reduce(
    (sum, v) => sum + (v.trackInventory ? Math.max(0, Number(v.quantity) || 0) : 0),
    0,
  )
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
    categoryId: form.categoryId,
    productType: form.productType.trim() || null,
    tags: form.tags,
    seoTitle: form.seoTitle.trim() || null,
    seoDescription: form.seoDescription.trim() || null,
    seoKeywords: form.seoKeywords,
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
      // Blank lists the variant before its price is confirmed (#913): shown, never sold.
      pricePaise: rupees.toPaise(v.price),
      mrpPaise: rupees.toPaise(v.mrp),
      costPaise: rupees.toPaise(v.cost),
      sku: v.sku.trim() || null,
      barcode: v.barcode.trim() || null,
      taxable: v.taxable,
      trackInventory: v.trackInventory,
      weightGrams: toGrams(v.weight, v.weightUnit),
      weightUnit: v.weightUnit,
      hsCode: v.hsCode.trim() || null,
      countryOfOrigin: v.countryOfOrigin.trim() || null,
      gstRatePercent: v.gstRate.trim() === '' ? null : Number(v.gstRate),
      boxPresetId: v.boxPresetId,
      packageLengthCm: v.packageLengthCm,
      packageWidthCm: v.packageWidthCm,
      packageHeightCm: v.packageHeightCm,
      onHand: v.trackInventory ? (intOrNull(v.quantity) ?? 0) : undefined,
      mediaId: v.mediaIds[0] ?? null,
      mediaIds: v.mediaIds,
    })),
  }
}

/** Client-side checks that give an inline message before the round trip. */
export type FormErrors = {
  title?: string
  variants?: string
  /** Custom box with only some of its dimensions filled in. */
  package?: string
  preorderDeposit?: string
}

export function formErrors(copy: typeof productFormContent, form: ProductFormState): FormErrors {
  const errors: FormErrors = {}
  if (!form.title.trim()) errors.title = 'required'
  const empty = form.options.find((o) => !o.values.some((v) => v.trim()))
  if (empty)
    errors.variants = copy.errors.optionNeedsValue(empty.name.trim() || copy.errors.newOption)
  // A blank price is fine (#913: listed before pricing is confirmed); a typed one must read.
  const bad = form.variants.find((v) => v.price.trim() !== '' && rupees.toPaise(v.price) == null)
  if (bad && !errors.variants)
    errors.variants = copy.errors.priceInvalid(variantTitle(bad.optionValues))
  const dims = form.variants.map((v) => [v.packageLengthCm, v.packageWidthCm, v.packageHeightCm])
  if (dims.some((d) => d.some((n) => n != null) && d.some((n) => n == null))) {
    errors.package = copy.shipping.packageIncomplete
  }
  if (form.preorderEnabled) {
    if (form.preorderPaymentMode === 'fixed') {
      const deposit = rupees.toPaise(form.preorderDeposit)
      const lowestPrice = Math.min(
        ...form.variants.map((v) => rupees.toPaise(v.price) ?? Number.POSITIVE_INFINITY),
      )
      if (deposit == null) errors.preorderDeposit = copy.errors.depositMissing
      else if (Number.isFinite(lowestPrice) && deposit >= lowestPrice) {
        errors.preorderDeposit = copy.errors.depositTooHigh
      }
    }
    if (form.preorderPaymentMode === 'percentage') {
      const pct = Number(form.preorderDepositPercent)
      if (!Number.isInteger(pct) || pct < 1 || pct > 99) {
        errors.preorderDeposit = copy.errors.depositPercent
      }
    }
  }
  return errors
}

/** "Classic T-Shirt" + ["Red", "M"] -> "CLASSIC-T-SHIRT-RED-M", trimmed to a sane length. */
export function suggestSku(title: string, optionValues: string[]): string {
  const part = (s: string) =>
    s
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  const parts = [part(title), ...optionValues.map(part)].filter(Boolean)
  return parts.join('-').slice(0, 60)
}

/** Percent margin and profit for the pricing card; null when cost or price is missing. */
export function margin(price: string, cost: string): { pct: number; profitPaise: number } | null {
  const p = rupees.toPaise(price)
  const c = rupees.toPaise(cost)
  if (p == null || c == null || p === 0) return null
  return { pct: Math.round(((p - c) / p) * 1000) / 10, profitPaise: p - c }
}
