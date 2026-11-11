'use client'

import { toast } from 'sonner'
import { orderDetailContent } from '@/data/order-detail'
import { ordersContent } from '@/data/orders'
import { paymentRulesContent } from '@/data/payment-rules'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

/**
 * The order page's one-call actions (Restore order, Mark as unfulfilled, Mark as not delivered,
 * Archive / Unarchive, Capture payment), each toasted and followed by `onDone`. `setBusy` is the page's own busy flag, so its other
 * buttons wait too. Split from `order-view.tsx` to keep it under the file-size cap.
 */
export function useOrderUndo(
  orderId: string,
  setBusy: (busy: boolean) => void,
  onDone: () => void,
) {
  const copy = useCopy(orderDetailContent)
  const listCopy = useCopy(ordersContent)
  const { order: captureCopy } = useCopy(paymentRulesContent)

  /** `failed` replaces the API's message (archive has its own); else the API's words show. */
  const run = async (call: () => Promise<unknown>, done: string, failed?: string) => {
    setBusy(true)
    try {
      await call()
      toast.success(done)
      onDone()
    } catch (err) {
      toast.error(failed ?? (err instanceof Error ? err.message : listCopy.bulk.failed))
    } finally {
      setBusy(false)
    }
  }

  return {
    restore: () => run(() => api.orders.restore({ id: orderId }), copy.actions.restored),
    markNotShipped: () =>
      run(() => api.orders.markNotShipped({ id: orderId }), copy.actions.markedNotShipped),
    markNotDelivered: () =>
      run(() => api.orders.markNotDelivered({ id: orderId }), copy.actions.markedNotDelivered),
    archive: (archived: boolean) =>
      run(
        () => api.orders.archiveMany({ ids: [orderId], archived }),
        archived ? copy.archive.archived : copy.archive.unarchived,
        copy.archive.failed,
      ),
    /** "Capture payment" (#150): take the money a manual-capture checkout only authorised. */
    capture: (paymentId: string) =>
      run(() => api.orders.capture({ paymentId }), captureCopy.captured),
  }
}
