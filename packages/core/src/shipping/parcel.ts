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

export type PackageDimensionsCm = { lengthCm: number; widthCm: number; heightCm: number }

/**
 * Couriers bill by whichever is greater, actual or "volumetric" weight - a
 * stand-in for how much room a light, bulky parcel takes on their trucks.
 * The industry-standard Indian-courier divisor is 5000 (cm³ per kg).
 */
export function volumetricWeightGrams(dims: PackageDimensionsCm): number {
  const cm3 = dims.lengthCm * dims.widthCm * dims.heightCm
  return Math.ceil(cm3 / 5000) * 1000
}

/** The heavier of a parcel's actual and volumetric weight, in grams. */
export function effectiveWeightGrams(
  actualGrams: number,
  dims: PackageDimensionsCm | null | undefined,
): number {
  if (!dims) return actualGrams
  return Math.max(actualGrams, volumetricWeightGrams(dims))
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
 * dimensions) - otherwise the store's default box, since a mixed order
 * needs the merchant's own packing judgement more than ours.
 */
export function resolveParcelPackage(
  lines: LinePackage[],
  boxPresets: { id: string; lengthCm: number; widthCm: number; heightCm: number }[],
): PackageDimensionsCm | null {
  const packed = lines.filter((l) => l.quantity > 0)
  if (packed.length === 0) return null

  const dimsOf = (l: LinePackage): PackageDimensionsCm | null => {
    if (l.packageLengthCm != null && l.packageWidthCm != null && l.packageHeightCm != null) {
      return { lengthCm: l.packageLengthCm, widthCm: l.packageWidthCm, heightCm: l.packageHeightCm }
    }
    if (l.boxPresetId) {
      const preset = boxPresets.find((b) => b.id === l.boxPresetId)
      if (preset) return preset
    }
    return null
  }

  const first = dimsOf(packed[0] as LinePackage)
  if (!first) return null
  const sameForAll = packed.every((l) => {
    const d = dimsOf(l)
    return d && d.lengthCm === first.lengthCm && d.widthCm === first.widthCm && d.heightCm === first.heightCm
  })
  return sameForAll ? first : null
}
