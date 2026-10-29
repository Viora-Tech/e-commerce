/** SOURCE OF TRUTH: product and variant row mapping — WHAT: how a ProductWrite / VariantInput becomes the columns saved, plus the pre-order deposit check / WHY: create and update share one mapping, so a field is never written by one and forgotten by the other */
import { validateDepositAgainstPrice, withPreorderAllowed } from '../preorder/settings'
import type { ProductWrite } from './schemas'
import { type VariantInput, variantTitle } from './variants'

export type ProductFields = Omit<ProductWrite, 'options' | 'variants' | 'inventoryReason'>

export function productRow(fields: ProductFields) {
  return {
    title: fields.title,
    description: fields.description ?? null,
    vendor: fields.vendor || null,
    categoryId: fields.categoryId || null,
    productType: fields.productType || null,
    tags: dedupe(fields.tags ?? []),
    seoTitle: fields.seoTitle || null,
    seoDescription: fields.seoDescription || null,
    ...(fields.seoKeywords === undefined ? {} : { seoKeywords: dedupe(fields.seoKeywords) }),
    ...(fields.templateSuffix === undefined
      ? {}
      : { templateSuffix: fields.templateSuffix || null }),
    status: fields.status ?? 'draft',
    taxIncluded: fields.taxIncluded ?? true,
    featured: fields.featured ?? false,
    saleStartsAt: fields.saleStartsAt ?? null,
    saleEndsAt: fields.saleEndsAt ?? null,
    preorderEnabled: fields.preorderEnabled ?? false,
    preorderShipDate: fields.preorderShipDate ?? null,
    preorderShipsInDays: fields.preorderShipsInDays ?? null,
    preorderLimit: fields.preorderLimit ?? null,
    // Writers that never show the note (imports, bulk tools) keep the merchant's.
    ...(fields.preorderNote === undefined ? {} : { preorderNote: fields.preorderNote || null }),
    preorderButtonLabel: fields.preorderButtonLabel || 'Pre-order',
    preorderPaymentMode: fields.preorderPaymentMode ?? 'full',
    preorderDepositPaise: fields.preorderDepositPaise ?? null,
    preorderDepositPercent: fields.preorderDepositPercent ?? null,
    preorderHideFromCollectionsUntilLaunch: fields.preorderHideFromCollectionsUntilLaunch ?? false,
    launchAt: fields.launchAt ?? null,
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

export function variantRow(input: VariantInput) {
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
    // Writers that do not know the setting (imports, bulk tools) keep the merchant's choice.
    ...(input.hiddenOnStore === undefined ? {} : { hiddenOnStore: input.hiddenOnStore }),
    // The variant's "Allow pre-order" switch is the only override key the admin edits.
    ...(input.preorderAllowed === undefined
      ? {}
      : { preorderOverride: withPreorderAllowed(null, input.preorderAllowed) }),
    // Writers that never show the unit (imports, bulk tools) leave the merchant's choice alone.
    ...(input.weightUnit === undefined ? {} : { weightUnit: input.weightUnit }),
    hsCode: input.hsCode ?? null,
    countryOfOrigin: input.countryOfOrigin ?? null,
    gstRatePercent: input.gstRatePercent ?? null,
    boxPresetId: input.boxPresetId ?? null,
    packageLengthCm: input.packageLengthCm ?? null,
    packageWidthCm: input.packageWidthCm ?? null,
    packageHeightCm: input.packageHeightCm ?? null,
    // The main image is the first of an ordered list when one is sent (catalog/variant-media.ts).
    mediaId: input.mediaIds !== undefined ? (input.mediaIds[0] ?? null) : (input.mediaId ?? null),
  }
}

/** A fixed deposit must be less than every variant's price, so there is always a balance to defer. */
export function preorderErrors(write: ProductWrite): string[] {
  if (!write.preorderEnabled || write.preorderPaymentMode !== 'fixed') return []
  return write.variants
    .map((v) =>
      validateDepositAgainstPrice('fixed', write.preorderDepositPaise ?? null, v.pricePaise),
    )
    .filter((e): e is string => e !== null)
}
