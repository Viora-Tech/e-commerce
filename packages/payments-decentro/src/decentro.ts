/**
 * Decentro UPI collections adapter (v3 Payment Aggregator stack). Official docs used:
 * - Generate Dynamic QR:  https://docs.decentro.tech/reference/payments_api-collectionsv3-dynamicqr
 * - Generate Payment Link: https://docs.decentro.tech/reference/payments_api-collectionsv3-paymentlink
 * - Get Transaction Status (Advance): https://docs.decentro.tech/reference/get-transaction-status-advance
 * - Get Transaction Status (Basic):   https://docs.decentro.tech/reference/get-transaction-status-basic
 * - Issue Refund: https://docs.decentro.tech/reference/payments_api-collectionsv3-refund
 * - Terminal Transaction Status Callback: https://docs.decentro.tech/reference/payments_api-collectionsv3-statuscallback
 * - Status values: https://docs.decentro.tech/docs/upi-collection-v3-configurations-and-status-values
 *
 * Decentro does not sign its callbacks. It sends back custom headers the
 * merchant registers with Decentro support, so we check a shared secret in
 * one of them (timing-safe) and fail closed without one, like our courier
 * webhooks. The callback's `consumer_urn` must also be this merchant's.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto'
import type {
  ClientConfirmation,
  ConnectionTestResult,
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  PaymentProviderFactory,
  PaymentStatus,
  PayoutRefundInput,
  PayoutRefundResult,
  RefundContext,
  WebhookEvent,
  WebhookVerification,
} from '@commerce/payments'
import {
  DecentroApiError,
  type DecentroCredentials,
  type DecentroMode,
  decentroRequest,
  isAuthError,
  narration,
  rupees,
  toPaise,
} from './client'
import { initiateUpiPayout } from './payouts'

export type DecentroConfig = {
  clientId: string
  clientSecret: string
  /** Issued by Decentro at onboarding; identifies the merchant on every collection. */
  consumerUrn: string
  mode: DecentroMode
  /** Checkout style: a QR on the order page (default), or a UPI link that opens the shopper's app. */
  flow: 'qr' | 'link'
  /** Shared secret Decentro sends back in the `x-webhook-token` header of each callback. */
  webhookSecret?: string | undefined
  /** Consumer URN for payouts, when Decentro gave a separate one; defaults to `consumerUrn`. */
  payoutConsumerUrn?: string | undefined
}

export const DECENTRO_ID = 'decentro'

/** The header the merchant asks Decentro to send with every callback. */
export const DECENTRO_WEBHOOK_HEADER = 'x-webhook-token'

/** What Decentro wants back, or it retries the callback. */
export const DECENTRO_CALLBACK_ACK = { response_code: 'CB_S00000' } as const

/** How long a QR or link stays payable. Decentro allows 1 to 1440 minutes. */
export const DECENTRO_EXPIRY_MINUTES = 30

/** Decentro's documented floor for a UPI collection. */
const MIN_AMOUNT_PAISE = 500

/** `purpose_message`: under 50 characters; refunds need 5 to 50. */
const PURPOSE_MAX = 49

type QrData = { dynamic_qr_image?: string; transaction_status?: string }
type LinkData = { upi_uris?: { common_uri?: string }; transaction_status?: string }

type AdvanceStatusData = {
  transaction_description?: {
    transaction_status?: string
    transaction_amount?: number | string
    request_decentro_txn_id?: string
    reference_id?: string
  }
  transaction_attempt_description?: Array<{
    decentro_txn_id?: string
    transaction_attempt_status?: string
    amount?: number | string
    payer_vpa?: string
  }>
}

type BasicStatusData = {
  transaction_status?: string
  request_decentro_txn_id?: string
}

type RefundData = { refund_status?: string; refund_status_description?: string }

export type DecentroCallback = {
  callback_txn_id?: string
  original_callback_txn_id?: string
  consumer_urn?: string
  transaction_status?: string
  transaction_status_description?: string
  amount?: number
  paid_amount?: number
  decentro_txn_id?: string
  attempt_decentro_txn_id?: string
  reference_id?: string
  transaction_attempt_status?: string
  attempt_action?: string
  error_key?: string
  error_key_description?: string
  payer_vpa?: string
}

/**
 * Decentro transaction status to ours. FAILED and EXPIRED are terminal
 * (`failed`), as is REQUEST_UNINITIALIZED (the request never registered).
 * DEEMED and DISPUTED_AMOUNT wait for Decentro's final word, so stay pending.
 */
export function decentroStatus(status: string | undefined): PaymentStatus {
  switch ((status ?? '').toUpperCase()) {
    case 'SUCCESS':
      return 'captured'
    case 'FAILED':
    case 'FAILURE':
    case 'EXPIRED':
    case 'REQUEST_UNINITIALIZED':
      return 'failed'
    default:
      return 'pending'
  }
}

/**
 * Our `reference_id`: the attempt key `<orderId>:<n>` with `:` swapped for `-`
 * (Decentro refuses `:`), so a callback leads back to the attempt. Decentro
 * refuses a reference it has seen, so a repeated call can't make a second QR.
 */
export function decentroReferenceId(input: CreatePaymentInput): string {
  const key = input.idempotencyKey ?? `${input.orderId}:${randomBytes(4).toString('hex')}`
  return key.replace(/[^A-Za-z0-9-]/g, '-')
}

/** The attempt key and order id back from a `reference_id` we made. */
export function attemptFromReference(ref: string | undefined): {
  idempotencyKey: string | null
  orderId: string | null
} {
  if (!ref) return { idempotencyKey: null, orderId: null }
  const cut = ref.lastIndexOf('-')
  if (cut <= 0) return { idempotencyKey: null, orderId: null }
  const orderId = ref.slice(0, cut)
  return { idempotencyKey: `${orderId}:${ref.slice(cut + 1)}`, orderId }
}

/**
 * `dynamic_qr_image` as an `<img src>`. Staging returns the PNG as bare base64 (no
 * `data:` prefix), which a browser shows as a broken image; a URL or data URI passes
 * through unchanged.
 */
export function qrImageSrc(value: string | undefined): string | null {
  const v = value?.trim()
  if (!v) return null
  if (/^(https?:|data:)/i.test(v)) return v
  const mime = v.startsWith('/9j/')
    ? 'image/jpeg'
    : v.startsWith('PHN2Zy')
      ? 'image/svg+xml'
      : 'image/png'
  return `data:${mime};base64,${v.replace(/\s+/g, '')}`
}

/** Decentro's "this reference id matches nothing" answer, however it phrases it. */
function isUnknownReference(err: DecentroApiError): boolean {
  const key = err.responseKey ?? ''
  return /reference/i.test(key) || /invalid reference id/i.test(err.message)
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

/** Attempt-level outcomes that send the money back instead of keeping it. */
const RETURNED_ACTIONS = new Set(['RELEASED', 'AUTO_REFUND', 'AUTO_REFUNDED'])

/**
 * Decentro UPI: a dynamic QR (or UPI link) per attempt, confirmed by
 * Decentro's callback or a status check. Money is refunded to the payer's
 * UPI ID through Decentro's refund API; `refundViaPayout` sends a fresh UPI
 * payout instead when that is needed.
 */
export class DecentroProvider implements PaymentProvider {
  readonly id: string = DECENTRO_ID
  readonly label: string = 'UPI (Decentro)'
  readonly webhookAck = DECENTRO_CALLBACK_ACK

  constructor(
    protected readonly config: DecentroConfig,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private get creds(): DecentroCredentials {
    return {
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      mode: this.config.mode,
    }
  }

  private call<T>(method: 'GET' | 'POST', path: string, body?: unknown) {
    return decentroRequest<T>(this.fetchImpl, this.creds, 'collections', method, path, body)
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (input.amountPaise < MIN_AMOUNT_PAISE) {
      throw new Error('Decentro takes UPI payments of ₹5 or more.')
    }
    const expiresAt = new Date(this.now().getTime() + DECENTRO_EXPIRY_MINUTES * 60_000)
    const body: Record<string, unknown> = {
      reference_id: decentroReferenceId(input),
      consumer_urn: this.config.consumerUrn,
      amount: rupees(input.amountPaise),
      purpose_message: narration(
        input.orderNumber != null ? `Order ${input.orderNumber}` : 'Order payment',
        PURPOSE_MAX,
        'Order payment',
      ),
      expiry_time: DECENTRO_EXPIRY_MINUTES,
    }
    if (input.returnUrl?.startsWith('https://')) body.redirect_url = input.returnUrl

    if (this.config.flow === 'link') {
      const res = await this.call<LinkData>('POST', '/v3/payments/upi/link', {
        ...body,
        generate_psp_uri: false,
      })
      const url = res.data?.upi_uris?.common_uri
      if (!res.decentro_txn_id || !url) throw new Error('Decentro did not return a payment link.')
      return {
        providerRef: res.decentro_txn_id,
        status: 'pending',
        session: { kind: 'redirect', provider: this.id, providerRef: res.decentro_txn_id, url },
      }
    }

    const res = await this.call<QrData>('POST', '/v3/payments/upi/qr', {
      ...body,
      generate_custom_qr_image: false,
    })
    const imageUrl = qrImageSrc(res.data?.dynamic_qr_image)
    if (!res.decentro_txn_id || !imageUrl) throw new Error('Decentro did not return a QR code.')
    return {
      providerRef: res.decentro_txn_id,
      status: 'pending',
      session: {
        kind: 'upi_qr',
        provider: this.id,
        providerRef: res.decentro_txn_id,
        qr: { imageUrl, amountPaise: input.amountPaise, expiresAt: expiresAt.toISOString() },
      },
    }
  }

  /** Nothing is posted back from the browser; Decentro's status is the truth. */
  async confirm(providerRef: string, _confirmation: ClientConfirmation) {
    const { status, providerPaymentId } = await this.fetchStatus(providerRef)
    return { status, providerPaymentId }
  }

  /**
   * The payment request's status. The refund API takes the request's
   * `decentro_txn_id`, so that is also the payment id we record.
   */
  async fetchStatus(
    providerRef: string,
  ): Promise<{ status: PaymentStatus; providerPaymentId: string | null; amountPaise: number }> {
    const res = await this.call<AdvanceStatusData>(
      'GET',
      `/v3/payments/transaction/advance/status?decentro_txn_id=${encodeURIComponent(providerRef)}`,
    )
    const txn = res.data?.transaction_description
    const status = decentroStatus(txn?.transaction_status)
    const paid = res.data?.transaction_attempt_description?.find(
      (a) => (a.transaction_attempt_status ?? '').toUpperCase() === 'SUCCESS',
    )
    return {
      status,
      providerPaymentId: status === 'captured' ? providerRef : null,
      amountPaise: toPaise(paid?.amount ?? txn?.transaction_amount),
    }
  }

  /**
   * Refund to the payer's UPI ID. Partial refunds are allowed. The refund's
   * `reference_id` is our refund key, so a retried refund is refused by
   * Decentro as a duplicate and we report the first one instead.
   */
  async refund(
    paymentId: string,
    amountPaise: number,
    note?: string,
    context?: RefundContext,
  ): Promise<{ providerRefundId: string; status: 'pending' | 'processed' }> {
    const referenceId = (
      context?.refundKey ?? `rf-${paymentId}-${randomBytes(3).toString('hex')}`
    ).replace(/[^A-Za-z0-9-]/g, '-')
    try {
      const res = await this.call<RefundData>('POST', '/v3/payments/upi/refund', {
        reference_id: referenceId,
        original_transaction_id: paymentId,
        purpose_message: narration(note ?? 'Order refund', PURPOSE_MAX, 'Order refund', 5),
        amount: rupees(amountPaise),
      })
      const refundStatus = (res.data?.refund_status ?? '').toUpperCase()
      if (refundStatus === 'REFUND_FAILED') {
        throw new Error(res.data?.refund_status_description ?? 'Decentro could not refund this.')
      }
      return {
        providerRefundId: res.decentro_txn_id ?? referenceId,
        status: refundStatus === 'REFUNDED' ? 'processed' : 'pending',
      }
    } catch (err) {
      if (err instanceof DecentroApiError && err.responseKey === 'error_duplicate_reference_id') {
        return this.refundByReference(referenceId)
      }
      throw err
    }
  }

  private async refundByReference(
    referenceId: string,
  ): Promise<{ providerRefundId: string; status: 'pending' | 'processed' }> {
    const res = await this.call<BasicStatusData>(
      'GET',
      `/v3/payments/transaction/status?reference_id=${encodeURIComponent(referenceId)}`,
    )
    const s = (res.data?.transaction_status ?? '').toUpperCase()
    if (s === 'REFUND_FAILED') throw new Error('Decentro could not refund this.')
    return {
      providerRefundId: res.data?.request_decentro_txn_id ?? referenceId,
      status: s === 'REFUNDED' ? 'processed' : 'pending',
    }
  }

  /** A UPI payout from the merchant's funded Decentro account (Payouts v3). */
  refundViaPayout(input: PayoutRefundInput): Promise<PayoutRefundResult> {
    return initiateUpiPayout(
      this.fetchImpl,
      this.creds,
      this.config.payoutConsumerUrn || this.config.consumerUrn,
      input,
    )
  }

  parseWebhook(input: {
    rawBody: string
    headers: Record<string, string | undefined>
  }): WebhookVerification {
    // Fail closed: without a saved secret a genuine callback looks like any other POST.
    const secret = this.config.webhookSecret
    if (!secret) return { ok: false, reason: 'webhook secret not configured' }
    const bearer = input.headers.authorization?.replace(/^Bearer\s+/i, '')
    const got = input.headers[DECENTRO_WEBHOOK_HEADER] ?? bearer
    if (!got) return { ok: false, reason: 'missing token' }
    if (!safeEqual(got, secret)) return { ok: false, reason: 'bad token' }

    let body: DecentroCallback
    try {
      body = JSON.parse(input.rawBody) as DecentroCallback
    } catch {
      return { ok: false, reason: 'invalid json' }
    }
    if (!body || typeof body !== 'object' || !body.decentro_txn_id || !body.transaction_status) {
      return { ok: false, reason: 'not a transaction callback' }
    }
    if (body.consumer_urn !== this.config.consumerUrn) {
      return { ok: false, reason: 'callback is for another Decentro account' }
    }
    const eventId =
      body.original_callback_txn_id ||
      body.callback_txn_id ||
      `${body.decentro_txn_id}:${body.transaction_status}:${body.attempt_decentro_txn_id ?? ''}`
    return { ok: true, eventId, event: this.normalise(body) }
  }

  private normalise(body: DecentroCallback): WebhookEvent {
    const status = (body.transaction_status ?? '').toUpperCase()
    const attempt = (body.transaction_attempt_status ?? '').toUpperCase()
    const action = (body.attempt_action ?? '').toUpperCase()
    const eventName = `${status}${attempt ? `/${attempt}` : ''}${action ? `/${action}` : ''}`
    const providerRef = body.decentro_txn_id as string
    const { idempotencyKey, orderId } = attemptFromReference(body.reference_id)

    // A held attempt waits for the merchant; a released or auto-refunded one is going back.
    if (attempt === 'HOLD' || RETURNED_ACTIONS.has(action)) {
      return { type: 'ignored', eventName, raw: body }
    }
    const mapped = decentroStatus(status)
    if (status === 'SUCCESS') {
      return {
        type: 'payment.captured',
        providerRef,
        idempotencyKey,
        providerPaymentId: providerRef,
        amountPaise: toPaise(body.paid_amount ?? body.amount),
        orderId,
        raw: body,
      }
    }
    if (mapped === 'failed') {
      return {
        type: 'payment.failed',
        providerRef,
        idempotencyKey,
        providerPaymentId: body.attempt_decentro_txn_id || null,
        reason:
          body.error_key_description || body.transaction_status_description || status.toLowerCase(),
        orderId,
        raw: body,
      }
    }
    // PENDING, DEEMED, DISPUTED_AMOUNT and refund updates (their format is not documented).
    return { type: 'ignored', eventName, raw: body }
  }

  /**
   * Read-only probe for the Connect page: look up a reference that can't
   * exist. Good keys get "no transaction found"; bad keys an auth error.
   */
  async testConnection(): Promise<ConnectionTestResult> {
    // Letters and digits only: Decentro rejects some punctuation in reference ids.
    const probe = `conntest${randomBytes(6).toString('hex')}`
    const ok: ConnectionTestResult = {
      ok: true,
      message: 'Connected. Decentro accepted these keys.',
    }
    try {
      await this.call('GET', `/v3/payments/transaction/status?reference_id=${probe}`)
      return ok
    } catch (err) {
      if (err instanceof DecentroApiError) {
        if (isAuthError(err)) {
          return {
            ok: false,
            message:
              "Decentro didn't accept these keys. Check the Client ID and Client secret, and that Test or Live matches the keys.",
          }
        }
        // A made-up reference can't match a transaction. Decentro answers that either as
        // "no transaction found" or as "Invalid Reference ID" (seen on staging); both mean
        // the keys were accepted and the request reached the payments API.
        if (
          err.responseKey === 'error_no_transaction_found' ||
          err.status === 404 ||
          isUnknownReference(err)
        ) {
          return ok
        }
      }
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, message: `Could not reach Decentro: ${message}` }
    }
  }
}

export const decentroFactory: PaymentProviderFactory<DecentroConfig> = {
  id: DECENTRO_ID,
  label: 'Decentro (UPI)',
  fields: [
    { key: 'clientId', label: 'Client ID', required: true },
    { key: 'clientSecret', label: 'Client secret', secret: true, required: true },
    { key: 'consumerUrn', label: 'Consumer URN', required: true },
    {
      key: 'mode',
      label: 'Test or live',
      help: "'test' uses Decentro's staging, 'live' takes real money",
      hidden: true,
    },
    {
      key: 'flow',
      label: 'Checkout style',
      help: "'qr' shows a QR code on the order page; 'link' opens the shopper's UPI app",
      hidden: true,
    },
    { key: 'webhookSecret', label: 'Callback secret', secret: true },
    { key: 'payoutConsumerUrn', label: 'Payouts consumer URN' },
  ],
  methods: ['upi'],
  validateConfig(raw) {
    const r = (raw ?? {}) as Partial<Record<keyof DecentroConfig, string>>
    const errors: string[] = []
    if (!r.clientId?.trim()) errors.push('clientId is required')
    if (!r.clientSecret?.trim()) errors.push('clientSecret is required')
    if (!r.consumerUrn?.trim()) errors.push('consumerUrn is required')
    if (errors.length) return { ok: false, errors }
    return {
      ok: true,
      config: {
        clientId: (r.clientId as string).trim(),
        clientSecret: (r.clientSecret as string).trim(),
        consumerUrn: (r.consumerUrn as string).trim(),
        mode: r.mode === 'live' ? 'live' : 'test',
        flow: r.flow === 'link' ? 'link' : 'qr',
        webhookSecret: r.webhookSecret?.trim() || undefined,
        payoutConsumerUrn: r.payoutConsumerUrn?.trim() || undefined,
      },
    }
  },
  create: (config) => new DecentroProvider(config),
}
