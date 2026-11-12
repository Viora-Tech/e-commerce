import {
  DEFAULT_PROTECT_BPS,
  PROTECT_CATEGORIES,
  type ProtectCard,
  type ProtectCategory,
} from '@commerce/core/delhivery-protect'

/** The Delhivery Protect card as the form edits it: rates as typed percentages ('' = Delhivery's). */
export type ProtectDraft = {
  rates: Record<ProtectCategory, string>
  overrides: Array<{ productType: string; category: ProtectCategory }>
}

/** 25 basis points → "0.25". */
export const bpsToPercent = (bps: number): string => String(bps / 100)

/** "0.25" → 25; '' → null (Delhivery's rate); anything else unreadable or over 10% → undefined. */
export function percentToBps(text: string): number | null | undefined {
  const t = text.trim()
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0 || n > 10) return undefined
  return Math.round(n * 100)
}

export function protectDraftOf(card: ProtectCard | null | undefined): ProtectDraft {
  const rates = {} as Record<ProtectCategory, string>
  for (const c of PROTECT_CATEGORIES) {
    const own = card?.ratesBps[c]
    rates[c] = own == null ? '' : bpsToPercent(own)
  }
  return { rates, overrides: (card?.typeOverrides ?? []).map((o) => ({ ...o })) }
}

/** The card to save, or null while a rate is unreadable. A rate equal to Delhivery's is not kept,
 *  and overrides with no product type are dropped. */
export function protectCardOf(draft: ProtectDraft): Omit<ProtectCard, 'couriers'> | null {
  const ratesBps: ProtectCard['ratesBps'] = {}
  for (const c of PROTECT_CATEGORIES) {
    const bps = percentToBps(draft.rates[c])
    if (bps === undefined) return null
    if (bps !== null && bps !== DEFAULT_PROTECT_BPS[c]) ratesBps[c] = bps
  }
  const typeOverrides = draft.overrides
    .map((o) => ({ productType: o.productType.trim(), category: o.category }))
    .filter((o) => o.productType !== '')
  return { ratesBps, typeOverrides }
}
