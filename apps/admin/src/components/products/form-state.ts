import {
  type InventoryReason,
  type ProductStatus,
  type ProductWrite,
  variantTitle,
  type WeightUnit,
} from '@commerce/core/catalog'
import { ownFields } from '@commerce/core/preorder'
import { isRichTextEmpty, parseRichText, type RichTextValue } from '@commerce/richtext'
import type { productFormContent } from '@/data/product-form'
import { rupees } from '@/data/products'
import type { api } from '@/lib/api-client'
import { liftTax, type ProductTax } from './product-tax'
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
  /** Hidden on the storefront, kept in admin (#934). */
  hiddenOnStore: boolean
  /** Sells on pre-order once out of stock, while the product is on pre-order (default on). */
  preorderAllowed: boolean
  /** The variant's own pre-order limit as typed; blank uses the product's (or campaign's). */
  preorderLimit: string
  /** Shopify's "This is a physical product": off takes no shipping and never ships. */
  requiresShipping: boolean
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
  /** HSN code and GST rate for the whole product, or per variant (#63). */
  tax: ProductTax
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
  /** Blank uses the store's default note. */
  preorderNote: string
  preorderPaymentMode: 'full' | 'fixed' | 'percentage'
  preorderDeposit: string
  preorderDepositPercent: string
  preorderHideFromCollectionsUntilLaunch: boolean
  /** Pre-order campaign the product sells under (Products › Pre-orders); null = its own settings. */
  preorderCampaignId: string | null
  /** In a campaign, the settings it keeps its own (`PREORDER_OWN_FIELDS`). */
  preorderOwn: string[]
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
    hiddenOnStore: false,
    preorderAllowed: template?.preorderAllowed ?? true,
    preorderLimit: template?.preorderLimit ?? '',
    requiresShipping: template?.requiresShipping ?? true,
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
    tax: { hsCode: '', gstRate: '', perVariant: false },
    saleStartsAt: '',
    saleEndsAt: '',
    preorderEnabled: false,
    preorderShipDate: '',
    preorderShipsInDays: '',
    preorderLimit: '',
    preorderButtonLabel: 'Pre-order',
    preorderNote: '',
    preorderPaymentMode: 'full',
    preorderDeposit: '',
    preorderDepositPercent: '',
    preorderHideFromCollectionsUntilLaunch: false,
    preorderCampaignId: null,
    preorderOwn: [],
    launchAt: '',
    options: [],
    variants: [emptyVariant([])],
    media: [],
    inventoryReason: 'correction',
  }
}

export function fromProduct(p: LoadedProduct): ProductFormState {
  const variants = fromVariants(p)
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
    tax: liftTax(p, variants),
    saleStartsAt: toDateField(p.saleStartsAt),
    saleEndsAt: toDateField(p.saleEndsAt),
    preorderEnabled: p.preorderEnabled,
    preorderShipDate: toDateField(p.preorderShipDate),
    preorderShipsInDays: p.preorderShipsInDays == null ? '' : String(p.preorderShipsInDays),
    preorderLimit: p.preorderLimit == null ? '' : String(p.preorderLimit),
    preorderButtonLabel: p.preorderButtonLabel || 'Pre-order',
    preorderNote: p.preorderNote ?? '',
    preorderPaymentMode: p.preorderPaymentMode,
    preorderDeposit: rupees.toField(p.preorderDepositPaise),
    preorderDepositPercent:
      p.preorderDepositPercent == null ? '' : String(p.preorderDepositPercent),
    preorderHideFromCollectionsUntilLaunch: p.preorderHideFromCollectionsUntilLaunch,
    preorderCampaignId: p.preorderCampaignId ?? null,
    preorderOwn: p.preorderOwn ?? [],
    launchAt: toDateTimeField(p.launchAt),
    options: p.options.map((o) => ({
      id: o.id,
      name: o.name,
      values: o.values.map((v) => v.value),
    })),
    variants,
    media: p.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt, contentType: i.contentType })),
    inventoryReason: 'correction',
  }
}

/** Variant rows of a loaded product. */
function fromVariants(p: LoadedProduct): VariantRow[] {
  // A product imported without variants (Shopify "historical" items) still needs one row,
  // or the editor has nothing to show and renders a blank page.
  return p.variants.length === 0
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
        hiddenOnStore: v.hiddenOnStore,
        preorderAllowed: v.preorderAllowed,
        preorderLimit: v.preorderLimit == null ? '' : String(v.preorderLimit),
        requiresShipping: v.requiresShipping,
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
      }))
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

/** A variant's pre-order limit as typed: blank, or a whole number from 1 to 1,000,000. */
export function validVariantLimit(text: string): boolean {
  if (text.trim() === '') return true
  const n = Number(text)
  return Number.isInteger(n) && n >= 1 && n <= 1_000_000
}

/**
 * What a variant with a blank pre-order limit uses, for the field's placeholder: the product's
 * own limit (null: none), or the campaign's when the product is in one and does not keep its own.
 */
export function inheritedPreorderLimit(
  form: Pick<ProductFormState, 'preorderCampaignId' | 'preorderOwn' | 'preorderLimit'>,
): { from: 'product'; limit: number | null } | { from: 'campaign' } {
  if (form.preorderCampaignId && !form.preorderOwn.includes('limit')) return { from: 'campaign' }
  const n = Number(form.preorderLimit)
  const limit = form.preorderLimit.trim() !== '' && Number.isInteger(n) && n >= 1 ? n : null
  return { from: 'product', limit }
}

/** What the variant dialog needs to show the pre-order limit field and its placeholder. */
export type VariantPreorderContext = {
  /** The product takes pre-orders (its own switch or a campaign). */
  on: boolean
  inherited: ReturnType<typeof inheritedPreorderLimit>
}

/** The variant dialog's pre-order context for this form. */
export function variantPreorderContext(
  form: Pick<
    ProductFormState,
    'preorderEnabled' | 'preorderCampaignId' | 'preorderOwn' | 'preorderLimit'
  >,
): VariantPreorderContext {
  return {
    on: form.preorderEnabled || Boolean(form.preorderCampaignId),
    inherited: inheritedPreorderLimit(form),
  }
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
    hsCode: form.tax.hsCode.trim() || null,
    gstRatePercent: form.tax.gstRate.trim() === '' ? null : Number(form.tax.gstRate),
    featured: form.featured,
    saleStartsAt: fromDateField(form.saleStartsAt),
    saleEndsAt: fromDateField(form.saleEndsAt),
    preorderEnabled: form.preorderEnabled,
    preorderShipDate: fromDateField(form.preorderShipDate),
    preorderShipsInDays: intOrNull(form.preorderShipsInDays),
    preorderLimit: intOrNull(form.preorderLimit),
    preorderButtonLabel: form.preorderButtonLabel.trim() || 'Pre-order',
    preorderNote: form.preorderNote.trim() || null,
    preorderPaymentMode: form.preorderPaymentMode,
    preorderDepositPaise: rupees.toPaise(form.preorderDeposit),
    preorderDepositPercent: intOrNull(form.preorderDepositPercent),
    preorderHideFromCollectionsUntilLaunch: form.preorderHideFromCollectionsUntilLaunch,
    preorderCampaignId: form.preorderCampaignId,
    preorderOwn: ownFields(form.preorderOwn),
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
      hiddenOnStore: v.hiddenOnStore,
      preorderAllowed: v.preorderAllowed,
      // Blank clears the variant's own limit: it uses the product's (or campaign's) again.
      preorderLimit: intOrNull(v.preorderLimit),
      requiresShipping: v.requiresShipping,
      weightGrams: toGrams(v.weight, v.weightUnit),
      weightUnit: v.weightUnit,
      // One HSN and rate for the product unless "Different per variant" is on (#63): then a
      // variant's own value wins and a blank one uses the product's.
      hsCode: form.tax.perVariant ? v.hsCode.trim() || null : null,
      countryOfOrigin: v.countryOfOrigin.trim() || null,
      gstRatePercent: form.tax.perVariant && v.gstRate.trim() !== '' ? Number(v.gstRate) : null,
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
  // A variant's own pre-order limit is a whole number of at least 1, or blank.
  const badLimit = form.variants.find((v) => !validVariantLimit(v.preorderLimit))
  if (badLimit && !errors.variants)
    errors.variants = copy.errors.variantLimitInvalid(variantTitle(badLimit.optionValues))
  const dims = form.variants.map((v) => [v.packageLengthCm, v.packageWidthCm, v.packageHeightCm])
  if (dims.some((d) => d.some((n) => n != null) && d.some((n) => n == null))) {
    errors.package = copy.shipping.packageIncomplete
  }
  // In a campaign the product's payment only counts when it keeps its own (#142).
  const ownPayment = form.preorderCampaignId
    ? form.preorderOwn.includes('payment')
    : form.preorderEnabled
  if (ownPayment) {
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
