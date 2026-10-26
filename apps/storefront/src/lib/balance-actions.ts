'use server'

import 'server-only'

import { settingsSecret } from '@commerce/config'
import {
  BalanceNotPayable,
  balanceProvider,
  orderViewToken,
  payPath,
  startBalancePayment,
  thankYouPath,
} from '@commerce/core'
import { payment } from '@commerce/db'
import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from './db'
import { accessibleOrderId } from './order-access'
import { redirectToOrderPage } from './order-view-cookie'
import { nudgeOutbox } from './outbox'
import { storePaymentProviders } from './payments'
import { clientIp, rateLimited } from './rate-limit'
import { inStore } from './store-context'

/** Per IP and per order: taps on "Pay balance" each start (or reuse) a gateway session. */
const PAY_BALANCE_RULE = { limit: 10, windowMs: 60_000 }

/**
 * "Pay balance" on the thank-you page, the account order page and the signed
 * pay link. The store is the one the proxy resolved from the hostname, never
 * a form value. Two taps get the same open attempt; the gateway is asked
 * after the attempt is committed. Lands on the gateway, or back on the
 * thank-you page, which shows where the balance stands.
 */
export async function payBalanceAction(
  orderNumber: number,
  viewToken: string | null,
): Promise<void> {
  const h = await headers()
  const storeId = h.get('x-store-id')
  if (!storeId) throw new Error('store not resolved')
  // The caller must own the order or hold its view token: every exit below mints a fresh
  // one, which opens the order to whoever holds it (security audit 2026-10-06, A-00).
  const orderId = await accessibleOrderId(storeId, orderNumber, viewToken)
  // No order, or not theirs: the untokened link, which a stranger cannot open.
  if (!orderId) redirect(`/checkout/thank-you/${orderNumber}`)
  const oid: string = orderId
  const secret = settingsSecret()
  const back = (busy = false): Promise<never> =>
    redirectToOrderPage(
      `${thankYouPath(orderNumber, orderViewToken(oid, secret))}${busy ? '&balance=busy' : ''}`,
    )
  const [byIp, byOrder] = await Promise.all([
    rateLimited('pay-balance:ip', clientIp(h), PAY_BALANCE_RULE),
    rateLimited('pay-balance:order', `${storeId}:${orderNumber}`, PAY_BALANCE_RULE),
  ])
  if (!byIp.ok || !byOrder.ok) await back(true)

  const target = await inStore(storeId, async (tx) => {
    const [deposit] = await tx
      .select({ provider: payment.provider })
      .from(payment)
      .where(and(eq(payment.orderId, oid), eq(payment.purpose, 'order')))
      .limit(1)
    return balanceProvider(await storePaymentProviders(tx, storeId), deposit?.provider ?? null)
  })
  if (!target) return redirectToOrderPage(thankYouPath(orderNumber, orderViewToken(oid, secret)))

  const started = await startBalancePayment(db(), storeId, oid, target).catch((err: unknown) => {
    // Paid or cancelled meanwhile: the thank-you page shows where it stands.
    if (err instanceof BalanceNotPayable) return null
    throw err
  })
  if (started?.becameCaptured) await nudgeOutbox(storeId)
  if (started?.session?.kind === 'client') {
    await redirectToOrderPage(payPath(orderNumber, orderViewToken(oid, secret)))
  }
  if (started?.session?.kind === 'redirect') redirect(started.session.url)
  await back()
}
