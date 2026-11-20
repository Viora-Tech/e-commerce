import { formatInZone } from '@commerce/dates'
import { sampleTemplateDataByTemplate } from './samples'
import type { TemplateData, TemplateId } from './types'

const DAY = 86_400_000

/** "10 Oct 2026" (or "30 November 2026" with `long`), the way the templates print dates. */
function dateLabel(now: Date, days: number, long = false): string {
  return formatInZone(
    now.getTime() + days * DAY,
    { day: 'numeric', month: long ? 'long' : 'short', year: 'numeric' },
    { locale: 'en-GB' },
  )
}

/**
 * The sample for one template with its dates a few days after `now`, so the admin's preview
 * never shows a deadline that is already past (#116). The conformance suite keeps the fixed
 * `sampleTemplateDataByTemplate` so its output stays the same from run to run.
 */
export function sampleTemplateDataFor(template: TemplateId, now: Date = new Date()): TemplateData {
  const s = sampleTemplateDataByTemplate[template]
  return {
    ...s,
    ...(s.balance ? { balance: { ...s.balance, payByLabel: dateLabel(now, 7) } } : {}),
    ...(s.deadlineLabel ? { deadlineLabel: dateLabel(now, 2) } : {}),
    ...(s.giftCard?.expiresLabel
      ? { giftCard: { ...s.giftCard, expiresLabel: dateLabel(now, 365) } }
      : {}),
    ...(s.review?.rewardUntil
      ? { review: { ...s.review, rewardUntil: dateLabel(now, 30, true) } }
      : {}),
    ...(s.planBill?.dueLabel ? { planBill: { ...s.planBill, dueLabel: dateLabel(now, 5) } } : {}),
    ...(s.purchaseOrder?.expectedLabel
      ? { purchaseOrder: { ...s.purchaseOrder, expectedLabel: dateLabel(now, 14) } }
      : {}),
  }
}
