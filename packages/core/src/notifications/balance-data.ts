/** SOURCE OF TRUTH: balanceData — WHAT: the "balance due" block of the balance messages (owed, paid so far, pay-by date) / WHY: a deposit pre-order and an order an edit left owing are worded differently; split from deliver.ts to keep it small */
import { formatInZone } from '@commerce/dates'
import type { order } from '@commerce/db'
import { formatMoney } from '@commerce/money'
import type { TemplateData } from '@commerce/notifications'
import { balanceOwed } from '../preorder/balance'
import {
  balancePayBy,
  depositIsNonRefundable,
  type PreorderStoreSettings,
} from '../preorder/store-settings'

/**
 * What a deposit pre-order (or an order an edit left owing) still owes, for the balance
 * messages; undefined on other orders. An edit's balance has no pay-by date or deposit rule.
 */
export function balanceData(
  o: typeof order.$inferSelect,
  settings: PreorderStoreSettings,
): TemplateData['balance'] {
  const owed = balanceOwed(o)
  if (o.depositPaise === null) {
    if (o.balanceDuePaise === null && !o.balancePaidAt) return undefined
    return {
      dueLabel: formatMoney(owed),
      depositLabel: formatMoney(o.totalPaise - owed),
      kind: 'edit',
    }
  }
  const payBy = balancePayBy(settings, o.balanceRequestedAt)
  return {
    dueLabel: formatMoney(owed),
    depositLabel: formatMoney(o.totalPaise - owed),
    payByLabel: payBy
      ? formatInZone(payBy, { dateStyle: 'medium' })
      : undefined,
    depositNonRefundable: depositIsNonRefundable(settings),
  }
}
