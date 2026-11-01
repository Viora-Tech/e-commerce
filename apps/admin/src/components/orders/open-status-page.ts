import { toast } from 'sonner'
import { api } from '@/lib/api-client'

/**
 * "View order status page" (#1015): the shopper's signed page for this order, in a new tab. The
 * tab opens before the link is fetched so the browser does not block it as a pop-up.
 */
export async function openOrderStatusPage(orderId: string, failed: string): Promise<void> {
  const tab = window.open('', '_blank')
  const chat = await api.orders.whatsappChat({ kind: 'order', id: orderId }).catch(() => null)
  const url = chat?.links.order
  if (!tab) return
  if (!url) {
    tab.close()
    toast.error(failed)
    return
  }
  tab.opener = null
  tab.location.href = url
}
