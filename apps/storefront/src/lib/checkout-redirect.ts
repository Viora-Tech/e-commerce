import 'server-only'

import { settingsSecret } from '@commerce/config'
import { orderViewToken, type PlaceOrderResult, payPath, thankYouPath } from '@commerce/core'
import { redirect } from 'next/navigation'
import { redirectToOrderPage } from './order-view-cookie'

/** Open the gateway, or go straight to the thank-you page (which offers a retry when the gateway failed). */
export async function redirectAfterCheckout(
  result: Pick<PlaceOrderResult, 'session' | 'orderNumber' | 'orderId'> &
    Partial<Pick<PlaceOrderResult, 'resumedDraft'>>,
): Promise<never> {
  const token = orderViewToken(result.orderId, settingsSecret())
  // The same items again on the shopper's open draft: the page says it is the earlier checkout.
  const again = result.resumedDraft ? '&again=1' : ''
  if (result.session?.kind === 'client') {
    return redirectToOrderPage(`${payPath(result.orderNumber, token)}${again}`)
  }
  if (result.session?.kind === 'redirect') redirect(result.session.url)
  return redirectToOrderPage(`${thankYouPath(result.orderNumber, token)}${again}`)
}
