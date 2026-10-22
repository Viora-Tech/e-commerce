import type { WeightUnit } from '@commerce/core/catalog'

/** What the product page shows when a variant has no unit saved. */
export const DEFAULT_WEIGHT_UNIT: WeightUnit = 'kg'

const GRAMS_PER: Record<WeightUnit, number> = {
  g: 1,
  kg: 1000,
  lb: 453.59237,
  oz: 28.349523125,
}

/** Decimal places worth showing per unit: whole grams, then about a gram of precision. */
const DECIMALS: Record<WeightUnit, number> = { g: 0, kg: 3, lb: 3, oz: 2 }

/** Typed weight in `unit` to whole grams; blank or not a number is null. */
export function toGrams(text: string, unit: WeightUnit): number | null {
  const n = Number(text)
  if (text.trim() === '' || !Number.isFinite(n) || n < 0) return null
  return Math.round(n * GRAMS_PER[unit])
}

/** Grams as the text a field in `unit` shows: "1.25", never "1.250". */
export function fromGrams(grams: number | null, unit: WeightUnit): string {
  if (grams == null) return ''
  return String(Number((grams / GRAMS_PER[unit]).toFixed(DECIMALS[unit])))
}

/** The same weight re-expressed after the unit picker changes. */
export function convertWeight(text: string, from: WeightUnit, to: WeightUnit): string {
  return from === to ? text : fromGrams(toGrams(text, from), to)
}
