'use client'

import { toast } from 'sonner'
import { orderDetailContent } from '@/data/order-detail'
import { ordersContent } from '@/data/orders'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { SendChannel } from './reminder-channel-picker'
import type { CustomMessage } from './send-message-dialog'

/**
 * The order page's hand-sent messages (balance request, payment reminder, order link, ask to pay online), each
 * toasted and followed by `onSent`. `setBusy` is the page's own busy flag, so the page's buttons
 * wait for a send too.
 */
export function useOrderMessages(
  orderId: string,
  setBusy: (busy: boolean) => void,
  onSent: () => void,
) {
  const copy = useCopy(orderDetailContent)
  const listCopy = useCopy(ordersContent)

  const send = async (run: () => Promise<unknown>, done: string) => {
    setBusy(true)
    try {
      await run()
      toast.success(done)
      onSent()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : listCopy.bulk.failed)
    } finally {
      setBusy(false)
    }
  }

  return {
    requestBalance: (custom?: CustomMessage) =>
      send(
        () => api.orders.requestBalance({ orderId, custom }),
        copy.payment.preorder.requestedToast,
      ),
    sendReminder: (custom?: CustomMessage, channel?: SendChannel) =>
      send(
        () => api.orders.sendPaymentReminder({ orderId, custom, channel }),
        copy.payment.transfer.sentToast,
      ),
    sendOrderLink: (custom?: CustomMessage) =>
      send(() => api.orders.sendOrderLink({ orderId, custom }), copy.actions.orderLinkSent),
    askPayOnline: (custom?: CustomMessage) =>
      send(() => api.orders.requestOnlinePayment({ orderId, custom }), copy.actions.payOnlineSent),
  }
}
