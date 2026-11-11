/** Select value that leaves each variant's box as it is. */
export const KEEP = '__keep'
/** Select value that clears the box. */
export const NONE = '__none'

export type BulkShippingChoice = {
  /** Whole grams, or undefined when the field is empty or not a positive number. */
  weightGrams: number | undefined
  /** undefined keeps the box, null clears it, a string sets that preset. */
  boxPresetId: string | null | undefined
  /** True when at least one of weight or box would change. */
  ready: boolean
}

/** What "Set weight and box" would apply, from the raw weight field and the box select. */
export function bulkShippingChoice(weight: string, box: string): BulkShippingChoice {
  const grams = Number.parseInt(weight, 10)
  const weightGrams = Number.isFinite(grams) && grams > 0 ? grams : undefined
  const boxPresetId = box === KEEP ? undefined : box === NONE ? null : box
  return { weightGrams, boxPresetId, ready: weightGrams !== undefined || boxPresetId !== undefined }
}
