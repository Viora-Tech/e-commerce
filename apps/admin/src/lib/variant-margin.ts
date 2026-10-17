import { margin, type VariantRow } from '@/components/products/form-state'

/** The variant earning the most per sale, for the line under the variants table; null when no variant has a cost. */
export function bestMargin(
  variants: VariantRow[],
): { variant: VariantRow; profit: { pct: number; profitPaise: number } } | null {
  let best: { variant: VariantRow; profit: { pct: number; profitPaise: number } } | null = null
  for (const variant of variants) {
    const profit = margin(variant.price, variant.cost)
    if (profit && (!best || profit.profitPaise > best.profit.profitPaise))
      best = { variant, profit }
  }
  return best
}
