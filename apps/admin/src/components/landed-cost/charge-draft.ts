import {
  convertToPaise,
  minorToText,
  type PurchaseChargeKind,
  type PurchaseChargeUpdate,
  type PurchaseCurrency,
  parseAmountMinor,
  parseFxRate,
  type SplitMethod,
} from '@commerce/core/inventory'
import { rateText } from '@/components/purchase-orders/form-state'
import type { PreviewCharge, PreviewLine } from './types'

/** A charge as the dialog edits it: money stays text until saved. */
export type ChargeDraft = {
  kind: PurchaseChargeKind
  amount: string
  currency: PurchaseCurrency
  fxRate: string
  /** Rupees. */
  gst: string
  recoverable: boolean
  splitMethod: SplitMethod
  splitLineIds: string[]
  /** Rupees per line id. */
  manual: Record<string, string>
  payee: string
  note: string
  incurredAt: string
}

export function draftFrom(c: PreviewCharge | null): ChargeDraft {
  if (!c) {
    return {
      kind: 'freight_insurance',
      amount: '',
      currency: 'INR',
      fxRate: '1',
      gst: '',
      recoverable: false,
      splitMethod: 'by_weight',
      splitLineIds: [],
      manual: {},
      payee: '',
      note: '',
      incurredAt: '',
    }
  }
  const currency = c.currency as PurchaseCurrency
  return {
    kind: c.kind,
    amount: minorToText(c.amountMinor, currency),
    currency,
    fxRate: rateText(c.fxRate),
    gst: minorToText(c.gstPaise, 'INR'),
    recoverable: c.recoverable,
    splitMethod: c.splitMethod,
    splitLineIds: [...(c.splitLineIds ?? [])],
    manual: Object.fromEntries(
      (c.manualSplits ?? []).map((s) => [s.lineId, minorToText(s.amountPaise, 'INR')]),
    ),
    payee: c.payee ?? '',
    note: c.note ?? '',
    incurredAt: c.incurredAt ?? '',
  }
}

/** The rate, amount and amount in paise the draft adds up to; null where it is not valid yet. */
export function figuresOf(d: ChargeDraft) {
  const rate = d.currency === 'INR' ? '1' : parseFxRate(d.fxRate) ? d.fxRate.trim() : null
  const amountMinor = parseAmountMinor(d.amount, d.currency, d.kind === 'goods_adjustment')
  const totalPaise =
    amountMinor !== null && rate !== null ? convertToPaise(amountMinor, d.currency, rate) : null
  return { rate, amountMinor, totalPaise }
}

type DraftProblem = 'badRate' | 'needAmount' | 'needLines' | 'manualOff'

/** The API fields for a draft, or what is missing (a key of the dialog copy). */
export function chargeFields(
  d: ChargeDraft,
  lines: PreviewLine[],
): { error: DraftProblem } | { fields: Omit<PurchaseChargeUpdate, 'id'> } {
  const { rate, amountMinor, totalPaise } = figuresOf(d)
  if (amountMinor === null || totalPaise === null || rate === null) {
    return { error: rate === null ? 'badRate' : 'needAmount' }
  }
  const gstPaise = d.gst.trim() === '' ? 0 : parseAmountMinor(d.gst, 'INR')
  if (gstPaise === null) return { error: 'needAmount' }
  if (d.splitMethod === 'specific_lines' && d.splitLineIds.length === 0) {
    return { error: 'needLines' }
  }
  const manualSplits = lines.map((l) => ({
    lineId: l.lineId,
    amountPaise: parseAmountMinor(d.manual[l.lineId] ?? '', 'INR') ?? 0,
  }))
  const assigned = manualSplits.reduce((n, s) => n + s.amountPaise, 0)
  if (d.splitMethod === 'manual' && assigned !== totalPaise) return { error: 'manualOff' }
  return {
    fields: {
      kind: d.kind,
      amountMinor,
      currency: d.currency,
      fxRate: rate,
      gstPaise,
      recoverable: d.recoverable,
      splitMethod: d.splitMethod,
      splitLineIds: d.splitMethod === 'specific_lines' ? d.splitLineIds : undefined,
      manualSplits: d.splitMethod === 'manual' ? manualSplits : undefined,
      payee: d.payee.trim() || undefined,
      note: d.note.trim() || undefined,
      incurredAt: d.incurredAt || null,
    },
  }
}
