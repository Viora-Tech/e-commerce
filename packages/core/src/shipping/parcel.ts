/** SOURCE OF TRUTH: parcel weight, box presets — computes what a shipment weighs for booking */

export type WeighableLine = { quantity: number; variantWeightGrams: number | null | undefined }

/**
 * Per-order parcel weight: the sum of product weights when every line's variant carries one,
 * else the packed box's own weight (a named preset from Settings -> Shipping, or the caller's
 * fallback). The merchant can still edit the result per row before booking.
 */
export function resolveParcelWeightGrams(lines: WeighableLine[], boxWeightGrams: number): number {
  if (lines.length > 0 && lines.every((l) => l.variantWeightGrams != null && l.quantity > 0)) {
    const grams = lines.reduce((sum, l) => sum + l.quantity * (l.variantWeightGrams ?? 0), 0)
    /* Products saved with 0 g (Shopify's default for "no weight") weigh nothing on paper; a
       courier needs at least a gram, so they count as unknown, like a missing weight. */
    if (grams >= 1) return grams
  }
  return boxWeightGrams
}

export type PackageDimensionsCm = { lengthCm: number; widthCm: number; heightCm: number }

/**
 * Couriers bill by whichever is greater, actual or "volumetric" weight: a stand-in for how
 * much room a light, bulky parcel takes on their trucks. Indian couriers use L×W×H (cm) ÷ 5000
 * for kilograms, so cm³ ÷ 5 for grams, rounded up to the next gram. Slab rounding (500 g and
 * so on) is the courier's own and happens on their side.
 */
export function volumetricWeightGrams(dims: PackageDimensionsCm): number {
  return Math.ceil((dims.lengthCm * dims.widthCm * dims.heightCm) / 5)
}

/** The heavier of a parcel's actual and volumetric weight, in grams. */
export function effectiveWeightGrams(
  actualGrams: number,
  dims: PackageDimensionsCm | null | undefined,
): number {
  if (!dims) return actualGrams
  return Math.max(actualGrams, volumetricWeightGrams(dims))
}

/**
 * The named box a parcel is packed in, for its packing cost: the one every packed line's
 * product picks, else the store's main box (custom dimensions, mixed boxes or none set).
 * Null when the store has no boxes.
 */
export function parcelBoxPreset<B extends { id: string; isDefault: boolean }>(
  lines: readonly { quantity: number; boxPresetId: string | null | undefined }[],
  boxPresets: readonly B[],
): B | null {
  const packed = lines.filter((l) => l.quantity > 0)
  const ids = new Set(packed.map((l) => l.boxPresetId ?? null))
  const [only] = [...ids]
  const named = ids.size === 1 && only ? boxPresets.find((b) => b.id === only) : undefined
  return named ?? boxPresets.find((b) => b.isDefault) ?? boxPresets[0] ?? null
}

export type LinePackage = {
  quantity: number
  boxPresetId: string | null | undefined
  packageLengthCm: number | null | undefined
  packageWidthCm: number | null | undefined
  packageHeightCm: number | null | undefined
}

/**
 * The box to pack an order in: a product/variant's own package when every
 * sellable line agrees on one (same named box, or the same custom
 * dimensions). Null otherwise, and the booking falls back to the store's
 * default box as before, since a mixed order needs the merchant's own
 * packing judgement more than ours.
 */
export function resolveParcelPackage(
  lines: LinePackage[],
  boxPresets: { id: string; lengthCm: number; widthCm: number; heightCm: number }[],
): PackageDimensionsCm | null {
  const packed = lines.filter((l) => l.quantity > 0)
  if (packed.length === 0) return null

  const dimsOf = (l: LinePackage): PackageDimensionsCm | null => {
    // A 0 cm side is "not set" (an import's blank), not a real box.
    if (
      l.packageLengthCm != null &&
      l.packageWidthCm != null &&
      l.packageHeightCm != null &&
      l.packageLengthCm > 0 &&
      l.packageWidthCm > 0 &&
      l.packageHeightCm > 0
    ) {
      return { lengthCm: l.packageLengthCm, widthCm: l.packageWidthCm, heightCm: l.packageHeightCm }
    }
    if (l.boxPresetId) {
      const preset = boxPresets.find((b) => b.id === l.boxPresetId)
      if (preset) {
        return { lengthCm: preset.lengthCm, widthCm: preset.widthCm, heightCm: preset.heightCm }
      }
    }
    return null
  }

  const first = dimsOf(packed[0] as LinePackage)
  if (!first) return null
  const sameForAll = packed.every((l) => {
    const d = dimsOf(l)
    return (
      d &&
      d.lengthCm === first.lengthCm &&
      d.widthCm === first.widthCm &&
      d.heightCm === first.heightCm
    )
  })
  return sameForAll ? first : null
}
