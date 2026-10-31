import 'server-only'

import { settingsSecret } from '@commerce/config'
import { orderViewToken, type PlaceOrderResult, payPath, thankYouPath } from '@commerce/core'
import { redirect } from 'next/navigation'
import { redirectToOrderPage } from './order-view-cookie'

/** Open the gateway, or go straight to the thank-you page (which offers a retry when the gateway failed). */
export async function redirectAfterCheckout(
  result: Pick<PlaceOrderResult, 'session' | 'orderNumber' | 'orderId'>,
): Promise<never> {
  const token = orderViewToken(result.orderId, settingsSecret())
  if (result.session?.kind === 'client') {
    return redirectToOrderPage(payPath(result.orderNumber, token))
  }
  if (result.session?.kind === 'redirect') redirect(result.session.url)
  return redirectToOrderPage(thankYouPath(result.orderNumber, token))
}
