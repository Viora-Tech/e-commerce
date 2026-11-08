'use server'

import 'server-only'

import { settingsSecret } from '@commerce/config'
import {
  confirmClientPayment,
  orderViewToken,
  PaymentNotRetryable,
  payOnlineInstead,
  retryAndStartPayment,
  SPLIT_TENDER_PROVIDERS,
  syncOpenQrAttempt,
  thankYouPath,
} from '@commerce/core'
import { order, payment } from '@commerce/db'
import type { ClientConfirmation } from '@commerce/payments'
import { and, desc, eq, notInArray } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { redirectAfterCheckout } from './checkout-redirect'
import { db } from './db'
import { accessibleOrderId } from './order-access'
import { redirectToOrderPage } from './order-view-cookie'
import { nudgeOutbox } from './outbox'
import { payOnlineGateway, storePaymentProviders } from './payments'
import { clientIp, rateLimited } from './rate-limit'
import { requestStoreId } from './request-store'
import { inStore } from './store-context'

const PAYMENT_RETRY_IP_RULE = { limit: 20, windowMs: 60_000 }
/** The QR page checks every 15 s; a tap on "I've paid" adds a few more. */
const QR_CHECK_ORDER_RULE = { limit: 8, windowMs: 60_000 }

/**
 * "Retry payment" after a failed attempt: a new attempt on the same order,
 * with the same amount and gateway, then back to the gateway. Two taps make
 * one attempt; the order and its stock are untouched.
 */
export async function retryPaymentAction(orderNumber: number, viewToken: string | null) {
  const storeId = await requestStoreId()
  // The caller must own the order or hold its view token: every exit below mints a fresh
  // one, which opens the order to whoever holds it (security audit 2026-10-06, A-00).
  const orderId = await accessibleOrderId(storeId, orderNumber, viewToken)
  // No order, or not theirs: the untokened link, which a stranger cannot open.
  if (!orderId) redirect(`/checkout/thank-you/${orderNumber}`)
  const oid: string = orderId
  const backToThankYou = (): Promise<never> =>
    redirectToOrderPage(thankYouPath(orderNumber, orderViewToken(oid, settingsSecret())))
  const ip = clientIp(await headers())
  const [byIp, byOrder] = await Promise.all([
    rateLimited('payment-retry:ip', ip, PAYMENT_RETRY_IP_RULE),
    rateLimited('payment-retry:order', `${storeId}:${orderNumber}`, PAYMENT_RETRY_IP_RULE),
  ])
  // No error slot on this action's return type: over the limit lands back on
  // the thank-you page, same as a retry that turns out not to be needed.
  if (!byIp.ok || !byOrder.ok) await backToThankYou()
  const target = await inStore(storeId, async (tx) => {
    const [latest] = await tx
      .select({ provider: payment.provider })
      .from(payment)
      .where(
        and(eq(payment.orderId, oid), notInArray(payment.provider, [...SPLIT_TENDER_PROVIDERS])),
      )
      .orderBy(desc(payment.attempt), desc(payment.id))
      .limit(1)
    const providers = await storePaymentProviders(tx, storeId)
    const provider = providers.find((p) => p.id === latest?.provider)
    return provider ?? null
  })
  if (!target) {
    return redirectToOrderPage(thankYouPath(orderNumber, orderViewToken(oid, settingsSecret())))
  }
  const started = await retryAndStartPayment(db(), storeId, oid, target).catch((err: unknown) => {
    // Paid or cancelled meanwhile: the thank-you page shows where the order stands.
    if (err instanceof PaymentNotRetryable) return null
    throw err
  })
  // payment_received was already written to the outbox, in the same
  // transaction as the capture (applyPaymentStatus, via startPaymentAttempt).
  if (started?.becameCaptured) await nudgeOutbox(storeId)
  await redirectAfterCheckout({ session: started?.session ?? null, orderNumber, orderId: oid })
}

/**
 * "Pay online instead" on a transfer order's page (issue 1010): the open UPI / bank transfer
 * attempt gives way to one on the store's gateway, then on to the gateway as checkout does.
 * Same access rule and rate limit as "Retry payment"; a store without an online gateway, or an
 * order paid or cancelled meanwhile, lands back on the order page.
 */
export async function payOnlineAction(orderNumber: number, viewToken: string | null) {
  const storeId = await requestStoreId()
  const orderId = await accessibleOrderId(storeId, orderNumber, viewToken)
  if (!orderId) redirect(`/checkout/thank-you/${orderNumber}`)
  const oid: string = orderId
  const backToThankYou = (): Promise<never> =>
    redirectToOrderPage(thankYouPath(orderNumber, orderViewToken(oid, settingsSecret())))
  const ip = clientIp(await headers())
  const [byIp, byOrder] = await Promise.all([
    rateLimited('payment-retry:ip', ip, PAYMENT_RETRY_IP_RULE),
    rateLimited('payment-retry:order', `${storeId}:${orderNumber}`, PAYMENT_RETRY_IP_RULE),
  ])
  if (!byIp.ok || !byOrder.ok) await backToThankYou()
  const gateway = await inStore(storeId, async (tx) => {
    const [o] = await tx.select({ isTest: order.isTest }).from(order).where(eq(order.id, oid))
    return payOnlineGateway(tx, storeId, o?.isTest ?? false)
  })
  if (!gateway) return backToThankYou()
  const started = await payOnlineInstead(db(), storeId, oid, gateway.provider).catch(
    (err: unknown) => {
      if (err instanceof PaymentNotRetryable) return null
      throw err
    },
  )
  if (started?.becameCaptured) await nudgeOutbox(storeId)
  await redirectAfterCheckout({ session: started?.session ?? null, orderNumber, orderId: oid })
}

/**
 * The UPI QR page asks: has this QR been paid? Checks the gateway directly, so
 * the order turns paid even when its webhook is late or not set up. True once
 * paid; the page then refreshes to the paid state.
 */
export async function checkQrPaymentAction(orderNumber: number, viewToken: string | null) {
  const storeId = await requestStoreId()
  const limited = await rateLimited(
    'qr-check:order',
    `${storeId}:${orderNumber}`,
    QR_CHECK_ORDER_RULE,
  )
  if (!limited.ok) return false
  // Only for whoever can see the order: a stranger learns nothing about it and cannot make
  // us call the gateway for it (security audit 2026-10-06, A-00).
  const orderId = await accessibleOrderId(storeId, orderNumber, viewToken)
  if (!orderId) return false
  const target = await inStore(storeId, async (tx) => {
    const o = { id: orderId }
    const [latest] = await tx
      .select({ provider: payment.provider })
      .from(payment)
      .where(
        and(eq(payment.orderId, o.id), notInArray(payment.provider, [...SPLIT_TENDER_PROVIDERS])),
      )
      .orderBy(desc(payment.attempt), desc(payment.id))
      .limit(1)
    const providers = await storePaymentProviders(tx, storeId)
    const provider = providers.find((p) => p.id === latest?.provider)
    return provider ? { orderId: o.id, provider } : null
  })
  if (!target) return false
  const applied = await syncOpenQrAttempt(db(), storeId, target.orderId, target.provider)
  if (applied?.becameCaptured) await nudgeOutbox(storeId)
  return applied?.payment.status === 'captured'
}

/** Browser posts the gateway's confirmation after a client-side checkout. */
export async function confirmPaymentAction(providerRef: string, confirmation: ClientConfirmation) {
  const storeId = await requestStoreId()
  const applied = await inStore(storeId, async (tx) => {
    const [p] = await tx.select().from(payment).where(eq(payment.providerRef, providerRef))
    if (!p) return null
    const providers = await storePaymentProviders(tx, storeId)
    const provider = providers.find((x) => x.id === p.provider)
    if (!provider) return null
    return confirmClientPayment({ storeId, tx }, provider, providerRef, confirmation)
  })
  // payment_received was already written to the outbox inside `inStore`
  // above, in the same transaction as the capture (applyPaymentStatus).
  if (applied?.becameCaptured) await nudgeOutbox(storeId)
  return applied?.payment.status ?? null
}
