/** SOURCE OF TRUTH: estimateDraftGst — WHAT: the GST inside a draft order's total, worked out the way converting it bills it (each line's own rate, untaxed lines and gift cards at 0, composition stores at 0, the discount spread over the lines) / WHY: the draft editor shows "GST (estimated)" before the order exists, like checkout's "Includes ₹X GST". Pure. */
import { computeOrderGst } from './gst'
import { chargedGstRate, type StoreTaxSettings } from './settings'

export type DraftGstLine = {
  /** Quantity × unit price, before the discount. */
  grossPaise: number
  /** The line's own rate (the variant's, or a custom item's 0); null uses the store default. */
  ratePercent: number | null
  taxable: boolean
  giftCard: boolean
}

export type DraftGstEstimate = {
  taxPaise: number
  /** The one rate charged; null when lines carry different rates. */
  ratePercent: number | null
  /**
   * Prices already contain the GST (always, for now: checkout extracts it from the price, and
   * "add GST on top" is not built). The total does not change.
   */
  inclusive: true
}

/** The rate a draft line is billed at: none for gift cards, untaxed lines and composition stores. */
export const draftLineRate = (
  l: Pick<DraftGstLine, 'ratePercent' | 'taxable' | 'giftCard'>,
  storeRatePercent: number,
  tax: Pick<StoreTaxSettings, 'composition'>,
): number => (l.giftCard || !l.taxable ? 0 : chargedGstRate(l.ratePercent ?? storeRatePercent, tax))

export function estimateDraftGst(input: {
  lines: readonly DraftGstLine[]
  storeRatePercent: number
  tax: Pick<StoreTaxSettings, 'composition'>
  /** What the draft charges: goods after the discount, plus shipping. */
  totalPaise: number
  /** The discount taken off the goods. */
  reductionPaise: number
  shipToState: string | null
  storeState: string | null
}): DraftGstEstimate {
  const lines = input.lines.map((l) => ({
    grossPaise: l.grossPaise,
    ratePercent: draftLineRate(l, input.storeRatePercent, input.tax),
  }))
  if (lines.length === 0 || input.totalPaise <= 0) {
    return { taxPaise: 0, ratePercent: null, inclusive: true }
  }
  const gst = computeOrderGst({
    lines,
    totalPaise: input.totalPaise,
    reductionPaise: Math.max(0, input.reductionPaise),
    shipToState: input.shipToState,
    storeState: input.storeState,
  })
  const rates = new Set(lines.filter((l) => l.grossPaise > 0).map((l) => l.ratePercent))
  const [only] = [...rates]
  return {
    taxPaise: gst.taxPaise,
    ratePercent: rates.size === 1 && only !== undefined ? only : null,
    inclusive: true,
  }
}
