import type { CreateShipmentInput } from './types'

/**
 * Customs lines for a parcel going abroad, shared by the international couriers (DHL Express,
 * FedEx): every line needs an HS code, a made-in country and a weight, and Indian export
 * clearance will not pass a commercial invoice without them.
 */

export type CustomsLine = {
  title: string
  quantity: number
  unitPricePaise: number
  hsCode: string
  /** ISO 3166-1 alpha-2; India when the variant does not say. */
  countryOfOrigin: string
  sku: string | undefined
  /** One unit's weight. Lines without their own share what is left of the parcel's weight. */
  unitWeightGrams: number
}

export type CustomsLinesResult =
  | { ok: true; lines: CustomsLine[] }
  | { ok: false; missingHsCode: string[] }

/** HS codes are 6 to 10 digits (India's ITC-HS is 8); dots and spaces are written for reading. */
export function normaliseHsCode(raw: string | undefined): string | null {
  const digits = (raw ?? '').replace(/[\s.]/g, '')
  return /^\d{6,10}$/.test(digits) ? digits : null
}

export function customsLines(
  input: Pick<CreateShipmentInput, 'lines' | 'weightGrams'>,
): CustomsLinesResult {
  const missing = input.lines.filter((l) => !normaliseHsCode(l.hsCode)).map((l) => l.title)
  if (missing.length) return { ok: false, missingHsCode: missing }

  const known = input.lines.reduce((sum, l) => sum + (l.unitWeightGrams ?? 0) * l.quantity, 0)
  const unknownUnits = input.lines
    .filter((l) => !l.unitWeightGrams)
    .reduce((sum, l) => sum + l.quantity, 0)
  const share = unknownUnits
    ? Math.max(Math.floor((input.weightGrams - known) / unknownUnits), 1)
    : 0
  return {
    ok: true,
    lines: input.lines.map((l) => ({
      title: l.title,
      quantity: l.quantity,
      unitPricePaise: l.unitPricePaise,
      hsCode: normaliseHsCode(l.hsCode) as string,
      countryOfOrigin: (l.countryOfOrigin ?? '').trim().toUpperCase().slice(0, 2) || 'IN',
      sku: l.sku,
      unitWeightGrams: l.unitWeightGrams || share,
    })),
  }
}

/** "Add an HS code to …": the one message both international couriers show for a missing code. */
export function missingHsCodeMessage(courier: string, titles: string[]): string {
  const list =
    titles.slice(0, 3).join(', ') + (titles.length > 3 ? ` and ${titles.length - 3} more` : '')
  return `${courier} needs an HS code on every item for customs. Add one to ${list} (product › Shipping › HS code), then book again.`
}

/** Local time in India as "YYYY-MM-DDTHH:mm:ss", `minutesAhead` from `now`. */
export function indiaLocalTime(now: Date, minutesAhead = 0): string {
  const ist = new Date(now.getTime() + (330 + minutesAhead) * 60_000)
  return ist.toISOString().slice(0, 19)
}

/**
 * Street lines cut to a courier's per-line limit (DHL 45 characters, FedEx 35), breaking at
 * spaces and spilling into the next line, at most `count` lines.
 */
export function wrapAddressLines(
  parts: Array<string | undefined>,
  max: number,
  count: number,
): string[] {
  const text = parts.filter((p) => p?.trim()).join(', ')
  const lines: string[] = []
  let current = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = current ? `${current} ${word}` : word
    if (next.length > max) {
      if (current) lines.push(current)
      current = word.slice(0, max)
    } else current = next
  }
  if (current) lines.push(current)
  return lines.slice(0, count)
}
