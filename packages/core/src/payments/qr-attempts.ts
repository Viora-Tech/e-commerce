/** SOURCE OF TRUTH: retrying a payment and expired UPI QR attempts — WHAT: retryAndStartPayment, settling a QR attempt whose close time passed before its webhook landed, and syncing an open one with the gateway / WHY: "Get a new QR" can open the next attempt straight away; split out of attempts.ts */
import { type Db, withStore } from '@commerce/db'
import type { PaymentProvider } from '@commerce/payments'
import {
  attemptSnapshot,
  paymentAttempts,
  retryPayment,
  type StartedPayment,
  sessionOf,
  startPaymentAttempt,
} from './attempts'
import { type AppliedPayment, applyPaymentStatus } from './confirm'
import { OPEN_ATTEMPT_STATUSES } from './transitions'

/**
 * The latest attempt is a UPI QR whose close time has passed but whose
 * `qr_code.closed` webhook has not landed yet: ask the gateway and record the
 * answer, so "Get a new QR" can open the next attempt straight away. A QR
 * that was paid is captured instead; one the gateway cannot be asked about is
 * left open (the retry then hands the same attempt back).
 */
async function settleExpiredQrAttempt(
  db: Db,
  storeId: string,
  orderId: string,
  provider: PaymentProvider,
  now: Date = new Date(),
): Promise<AppliedPayment | null> {
  const latest = await withStore(db, storeId, async (tx) => {
    const attempts = await paymentAttempts({ storeId, tx }, orderId)
    return attempts.find((a) => a.purpose === 'order')
  })
  if (!latest || !(OPEN_ATTEMPT_STATUSES as readonly string[]).includes(latest.status)) return null
  const session = sessionOf(latest)
  if (session?.kind !== 'upi_qr' || new Date(session.qr.expiresAt) > now) return null
  let truth: Awaited<ReturnType<PaymentProvider['fetchStatus']>>
  try {
    truth = await provider.fetchStatus(latest.providerRef)
  } catch {
    return null
  }
  if (truth.status === 'authorized') return null
  return withStore(db, storeId, (tx) =>
    applyPaymentStatus(
      { storeId, tx },
      {
        paymentId: latest.id,
        status: truth.status === 'captured' ? 'captured' : 'failed',
        providerPaymentId: truth.providerPaymentId,
      },
    ),
  )
}

/**
 * The shopper is still looking at an open UPI QR: ask the gateway whether it
 * was paid, so the order turns paid without waiting for the webhook (late, or
 * not set up yet). Only a capture is recorded; anything else leaves the QR
 * open until it closes. Null when there is nothing to ask or the gateway
 * could not be asked.
 */
export async function syncOpenQrAttempt(
  db: Db,
  storeId: string,
  orderId: string,
  provider: PaymentProvider,
): Promise<AppliedPayment | null> {
  const latest = await withStore(db, storeId, async (tx) => {
    const attempts = await paymentAttempts({ storeId, tx }, orderId)
    return attempts.find((a) => a.purpose === 'order')
  })
  if (!latest || latest.provider !== provider.id) return null
  if (!(OPEN_ATTEMPT_STATUSES as readonly string[]).includes(latest.status)) return null
  if (sessionOf(latest)?.kind !== 'upi_qr') return null
  let truth: Awaited<ReturnType<PaymentProvider['fetchStatus']>>
  try {
    truth = await provider.fetchStatus(latest.providerRef)
  } catch {
    return null
  }
  if (truth.status !== 'captured') return null
  return withStore(db, storeId, (tx) =>
    applyPaymentStatus(
      { storeId, tx },
      { paymentId: latest.id, status: 'captured', providerPaymentId: truth.providerPaymentId },
    ),
  )
}

/** `retryPayment`, committed, then the new attempt started with the gateway. */
export async function retryAndStartPayment(
  db: Db,
  storeId: string,
  orderId: string,
  provider: PaymentProvider,
  now: Date = new Date(),
): Promise<StartedPayment> {
  const settled = await settleExpiredQrAttempt(db, storeId, orderId, provider, now)
  if (settled?.becameCaptured) return { ...attemptSnapshot(settled.payment), becameCaptured: true }
  const { attempt } = await withStore(db, storeId, (tx) => retryPayment({ storeId, tx }, orderId))
  if (attempt.status !== 'created') return attemptSnapshot(attempt)
  return startPaymentAttempt(db, storeId, attempt.id, provider)
}
