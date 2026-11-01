import type { VariantRow } from './form-state'

/** HSN code and GST rate set once for the product, and whether variants may differ (#63). */
export type ProductTax = {
  hsCode: string
  /** Blank uses the store rate. */
  gstRate: string
  /** "Different per variant": each variant's own value wins, blank ones use the product's. */
  perVariant: boolean
}

/**
 * The product-level value the form opens with, from the saved product value and its variants'.
 * A saved product value stays; otherwise one value every variant shares is lifted up (so a
 * product set variant by variant before #63 shows its HSN once). Variants that disagree, or a
 * variant that differs from the product value, open "Different per variant".
 */
export function liftTaxValue(
  saved: string,
  variantValues: readonly string[],
): { value: string; perVariant: boolean } {
  const product = saved.trim()
  const values = variantValues.map((v) => v.trim())
  if (product) return { value: product, perVariant: values.some((v) => v !== '' && v !== product) }
  const first = values[0] ?? ''
  if (values.every((v) => v === first)) return { value: first, perVariant: false }
  return { value: '', perVariant: true }
}

/** The form's product tax fields from a loaded product and its variant rows. */
export function liftTax(
  saved: { hsCode: string | null; gstRatePercent: number | null },
  variants: readonly Pick<VariantRow, 'hsCode' | 'gstRate'>[],
): ProductTax {
  const hs = liftTaxValue(
    saved.hsCode ?? '',
    variants.map((v) => v.hsCode),
  )
  const rate = liftTaxValue(
    saved.gstRatePercent == null ? '' : String(saved.gstRatePercent),
    variants.map((v) => v.gstRate),
  )
  return { hsCode: hs.value, gstRate: rate.value, perVariant: hs.perVariant || rate.perVariant }
}

/** What a variant is billed with: its own value when per-variant is on and it has one, else the product's. */
export function variantTax(
  tax: ProductTax,
  variant: Pick<VariantRow, 'hsCode' | 'gstRate'>,
): { hsCode: string; gstRate: string } {
  if (!tax.perVariant) return { hsCode: tax.hsCode.trim(), gstRate: tax.gstRate.trim() }
  return {
    hsCode: variant.hsCode.trim() || tax.hsCode.trim(),
    gstRate: variant.gstRate.trim() || tax.gstRate.trim(),
  }
}

/** Some variant would print no HSN on its invoice: the "1 to fix" on the Shipping tab. */
export function missingHsCode(
  tax: ProductTax,
  variants: readonly Pick<VariantRow, 'hsCode' | 'gstRate'>[],
): boolean {
  return variants.some((v) => variantTax(tax, v).hsCode === '')
}
