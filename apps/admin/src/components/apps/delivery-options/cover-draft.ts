import {
  type CourierCover,
  INSURED_COURIERS,
  type InsuredCourier,
  type ProtectCard,
} from '@commerce/core/delhivery-protect'
import { parseRupees } from '@commerce/money'
import { toRupees } from './format'

type Choice = 'default' | 'yes' | 'no'

/** One courier's cover terms as the form edits them; '' and 'default' keep the courier's own. */
export type CoverDraftRow = {
  cap: string
  limit: string
  excess: string
  fragile: Choice
  used: Choice
}
export type CoverDraft = Record<InsuredCourier, CoverDraftRow>

const choiceOf = (v: boolean | undefined): Choice =>
  v === undefined ? 'default' : v ? 'yes' : 'no'
const boolOf = (c: Choice): boolean | undefined => (c === 'default' ? undefined : c === 'yes')

export function coverDraftOf(card: ProtectCard | null | undefined): CoverDraft {
  const out = {} as CoverDraft
  for (const id of INSURED_COURIERS) {
    const own = card?.couriers?.[id]
    out[id] = {
      cap: toRupees(own?.coverCapPaise),
      limit: toRupees(own?.uninsuredLimitPaise),
      excess: own?.deductibleBps == null ? '' : String(own.deductibleBps / 100),
      fragile: choiceOf(own?.coversFragile),
      used: choiceOf(own?.excludesUsed),
    }
  }
  return out
}

/** "0.5" → 50 basis points; '' → undefined; unreadable or over 100% → null. */
function excessBps(text: string): number | undefined | null {
  const t = text.trim()
  if (t === '') return undefined
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) : null
}

/** The `couriers` part of the card, or null while a field is unreadable. */
export function coversOf(draft: CoverDraft): ProtectCard['couriers'] | null {
  const out: ProtectCard['couriers'] = {}
  for (const id of INSURED_COURIERS) {
    const d = draft[id]
    const cap = d.cap.trim() === '' ? undefined : parseRupees(d.cap)
    const limit = d.limit.trim() === '' ? undefined : parseRupees(d.limit)
    const excess = excessBps(d.excess)
    if (cap === null || limit === null || excess === null) return null
    const row = {
      ...(cap === undefined ? {} : { coverCapPaise: cap }),
      ...(limit === undefined ? {} : { uninsuredLimitPaise: limit }),
      ...(excess === undefined ? {} : { deductibleBps: excess }),
      ...(boolOf(d.fragile) === undefined ? {} : { coversFragile: boolOf(d.fragile) }),
      ...(boolOf(d.used) === undefined ? {} : { excludesUsed: boolOf(d.used) }),
    }
    if (Object.keys(row).length > 0) out[id] = row
  }
  return out
}

/** A default as a placeholder: "₹30,000"-style rupees, or '' when unknown. */
export const defaultRupees = (paise: CourierCover['coverCapPaise']): string => toRupees(paise)
