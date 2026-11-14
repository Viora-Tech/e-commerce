/**
 * Weights no parcel should have: a product saved in the wrong unit (a 1 kg mousepad saved as
 * 10,00,000 g made couriers quote for 1,000 kg, owner 14 Nov 2026). Past this, the Package step
 * asks to check the weight before booking.
 */
export const SUSPECT_GRAMS = 30_000

type WeighedLine = { title: string; weightGrams: number | null }

/** The items saved heavier than `SUSPECT_GRAMS` each, and whether the parcel itself is. */
export function suspectWeights(
  lines: readonly WeighedLine[],
  parcelGrams: number | null,
): { items: { title: string; grams: number }[]; parcel: boolean } | null {
  const items = lines
    .filter((l) => (l.weightGrams ?? 0) > SUSPECT_GRAMS)
    .map((l) => ({ title: l.title, grams: l.weightGrams as number }))
  const parcel = (parcelGrams ?? 0) > SUSPECT_GRAMS
  return items.length > 0 || parcel ? { items, parcel } : null
}
