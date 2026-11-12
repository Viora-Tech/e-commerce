/** SOURCE OF TRUTH: parcel weight, box presets — computes what a shipment weighs for booking and for checkout's courier prices */
import { ASSUMED_WEIGHT_GRAMS } from '@commerce/shipping'

export type WeighableLine = { quantity: number; variantWeightGrams: number | null | undefined }

/**
 * Per-order parcel weight: the products' own weights plus the packing (the box's weight from
 * Settings -> Shipping: the carton, bubble wrap and invoice). When any line has no weight the
 * products count as 500 g. A box is packing only, never the whole parcel (owner, 10 Nov 2026).
 * The merchant can still edit the result per row before booking.
 */
export function resolveParcelWeightGrams(lines: WeighableLine[], packingGrams: number): number {
  const packing = Math.max(0, Math.round(packingGrams || 0))
  if (lines.length > 0 && lines.every((l) => l.variantWeightGrams != null && l.quantity > 0)) {
    const grams = lines.reduce((sum, l) => sum + l.quantity * (l.variantWeightGrams ?? 0), 0)
    /* Products saved with 0 g (Shopify's default for "no weight") weigh nothing on paper; a
       courier needs at least a gram, so they count as unknown, like a missing weight. */
    if (grams >= 1) return grams + packing
  }
  return ASSUMED_WEIGHT_GRAMS + packing
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
 * The named box a parcel is packed in, for its packing cost: the one its products pick, and
 * when they pick different boxes the biggest of them (the small items go inside it: a glasspad
 * and skates ship in the glasspad box, #2461). The store's main box when none of them has one.
 * Null when the store has no boxes.
 */
export function parcelBoxPreset<
  B extends { id: string; isDefault: boolean; lengthCm: number; widthCm: number; heightCm: number },
>(
  lines: readonly { quantity: number; boxPresetId: string | null | undefined }[],
  boxPresets: readonly B[],
): B | null {
  const ids = new Set(lines.filter((l) => l.quantity > 0).map((l) => l.boxPresetId))
  const named = boxPresets.filter((b) => ids.has(b.id))
  return biggest(named) ?? boxPresets.find((b) => b.isDefault) ?? boxPresets[0] ?? null
}

const volume = (d: PackageDimensionsCm) => d.lengthCm * d.widthCm * d.heightCm

/** The box with the most room, or null for none. */
function biggest<D extends PackageDimensionsCm>(boxes: readonly D[]): D | null {
  return boxes.reduce<D | null>((big, b) => (!big || volume(b) > volume(big) ? b : big), null)
}

export type LinePackage = {
  quantity: number
  boxPresetId: string | null | undefined
  packageLengthCm: number | null | undefined
  packageWidthCm: number | null | undefined
  packageHeightCm: number | null | undefined
}

/**
 * The box to pack an order in: the products' own package (a named box or custom dimensions),
 * and when they differ the biggest of them, since the smaller items go inside it. Null when no
 * line has a package; the booking then uses the store's default box.
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

  // Mixed boxes: the biggest one, the rest pack inside it (#2461). Lines with no package of
  // their own ride along; none known at all, the booking uses the store's default box.
  return biggest(packed.flatMap((l) => dimsOf(l) ?? []))
}

export type CartParcelLine = WeighableLine & LinePackage

export type CartParcel = {
  /** The products plus the box's packing, as the admin weighs a parcel. */
  actualGrams: number
  /** What the courier bills: the heavier of actual and the box's volumetric weight. */
  billedGrams: number
  /** The box: the products' own (the biggest when they differ), else the store's main box. */
  dimensionsCm: PackageDimensionsCm | null
}

/**
 * The parcel a cart becomes, for checkout's courier prices: the same box, packing and billed
 * weight the admin books it with (`resolveParcelPackage`, `parcelBoxPreset`,
 * `resolveParcelWeightGrams`, `effectiveWeightGrams`), so a big light item is priced on its
 * volumetric weight, as the courier bills it (#1546, owner 11 Nov 2026).
 */
export function cartParcel<
  B extends {
    id: string
    isDefault: boolean
    lengthCm: number
    widthCm: number
    heightCm: number
    weightGrams: number
  },
>(lines: readonly CartParcelLine[], boxPresets: readonly B[]): CartParcel {
  const packed = lines.filter((l) => l.quantity > 0)
  const box = parcelBoxPreset(packed, boxPresets)
  // No product has a box: the booking flow starts in the store's main box, so checkout does too.
  const dimensionsCm =
    resolveParcelPackage(packed, [...boxPresets]) ??
    (box ? { lengthCm: box.lengthCm, widthCm: box.widthCm, heightCm: box.heightCm } : null)
  const actualGrams = resolveParcelWeightGrams(packed, box?.weightGrams ?? 0)
  return { actualGrams, billedGrams: effectiveWeightGrams(actualGrams, dimensionsCm), dimensionsCm }
}
