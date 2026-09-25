/** SOURCE OF TRUTH: parcel weight, box presets — computes what a shipment weighs for booking */

export type WeighableLine = { quantity: number; variantWeightGrams: number | null | undefined }

/**
 * Per-order parcel weight: the sum of product weights when every line's variant carries one,
 * else the packed box's own weight (a named preset from Settings -> Shipping, or the caller's
 * fallback). The merchant can still edit the result per row before booking.
 */
export function resolveParcelWeightGrams(lines: WeighableLine[], boxWeightGrams: number): number {
  if (lines.length > 0 && lines.every((l) => l.variantWeightGrams != null && l.quantity > 0)) {
    return lines.reduce((grams, l) => grams + l.quantity * (l.variantWeightGrams ?? 0), 0)
  }
  return boxWeightGrams
}
