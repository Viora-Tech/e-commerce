import type { gstInvoiceEditContent } from '@/data/gst-invoice-edit'
import type { api } from '@/lib/api-client'
import { monthLabel } from './return-months'

type Lock = Awaited<ReturnType<typeof api.gstInvoices.getEdit>>['lock']
type LockedCopy = (typeof gstInvoiceEditContent)['card']['locked']

/** Why an invoice cannot be edited now, in words; `null` while it can. */
export function lockText(locked: LockedCopy, lock: Lock): string | null {
  const reason = lock.reason
  if (!reason) return null
  const month = lock.period ? monthLabel(lock.period) : ''
  return reason === 'filed' || reason === 'closed' || reason === 'due_passed'
    ? locked[reason](month)
    : locked[reason]
}
