'use server'

import 'server-only'

import { settingsSecret } from '@commerce/config'
import {
  balanceProvider,
  CommerceError,
  convertDraftForOnlinePayment,
  DraftNeedsShippingAddress,
  draftInvoiceState,
  OutOfStock,
  orderViewToken,
  PaymentNotRetryable,
  payPath,
  retryAndStartPayment,
  startPaymentAttempt,
  thankYouPath,
  verifyInvoiceToken,
} from '@commerce/core'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { invoiceContent as content } from '@/data/checkout'
import { db } from './db'
import { redirectToOrderPage } from './order-view-cookie'
import { nudgeOutbox } from './outbox'
import { storePaymentProviders } from './payments'
import { clientIp, rateLimited } from './rate-limit'
import { inStore } from './store-context'

/** Per IP and per invoice: each tap on "Pay" may start a gateway session. */
const PAY_INVOICE_RULE = { limit: 10, windowMs: 60_000 }

export type PayInvoiceResult = { error: string } | undefined

/**
 * "Pay" on a draft invoice's signed page. The first tap turns the draft into an order on the
 * store's online gateway (stock held then, as at checkout) and starts the payment; a later tap
 * on the same link retries it. Lands on the gateway, or on the order's thank-you page once
 * there is nothing left to pay. The store comes from the hostname, never the form.
 */
export async function payInvoiceAction(token: string): Promise<PayInvoiceResult> {
  const h = await headers()
  const storeId = h.get('x-store-id')
  if (!storeId) throw new Error('store not resolved')
  const verified = verifyInvoiceToken(token, settingsSecret())
  if (!verified.ok) return { error: content.unavailable }
  const orderId = verified.orderId
  const [byIp, byInvoice] = await Promise.all([
    rateLimited('pay-invoice:ip', clientIp(h), PAY_INVOICE_RULE),
    rateLimited('pay-invoice:order', `${storeId}:${orderId}`, PAY_INVOICE_RULE),
  ])
  if (!byIp.ok || !byInvoice.ok) return { error: content.busy }

  const found = await inStore(storeId, async (tx) => {
    const o = await draftInvoiceState({ storeId, tx }, orderId)
    const provider = balanceProvider(await storePaymentProviders(tx, storeId), null)
    return o ? { ...o, provider } : null
  })
  if (!found) return { error: content.unavailable }
  const secret = settingsSecret()
  const thankYou = (): Promise<never> =>
    redirectToOrderPage(thankYouPath(found.number, orderViewToken(orderId, secret)))
  if (!found.payable) await thankYou()
  if (!found.provider) return { error: content.noGateway }
  const provider = found.provider

  let started: Awaited<ReturnType<typeof startPaymentAttempt>> | null
  try {
    if (found.status === 'draft') {
      const converted = await inStore(storeId, (tx) =>
        convertDraftForOnlinePayment({ storeId, tx }, orderId, provider.id),
      )
      if (!converted) return { error: content.unavailable }
      await nudgeOutbox(storeId)
      started = await startPaymentAttempt(db(), storeId, converted.attemptId, provider)
    } else {
      started = await retryAndStartPayment(db(), storeId, orderId, provider)
    }
  } catch (err) {
    if (err instanceof OutOfStock) return { error: content.outOfStock }
    if (err instanceof DraftNeedsShippingAddress) return { error: content.noAddress }
    if (err instanceof PaymentNotRetryable) await thankYou()
    if (err instanceof CommerceError) return { error: content.unavailable }
    throw err
  }
  if (started?.becameCaptured) await nudgeOutbox(storeId)
  const view = orderViewToken(orderId, secret)
  if (started?.session?.kind === 'client') await redirectToOrderPage(payPath(found.number, view))
  if (started?.session?.kind === 'redirect') redirect(started.session.url)
  await thankYou()
}
