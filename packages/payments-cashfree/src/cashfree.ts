/**
 * Cashfree Payment Gateway adapter. Official docs used:
 * - https://www.cashfree.com/docs/api-reference/payments/latest/orders/create
 * - https://www.cashfree.com/docs/api-reference/payments/latest/orders/get
 * - https://www.cashfree.com/docs/api-reference/payments/latest/payments/get-payments-for-an-order
 * - https://www.cashfree.com/docs/api-reference/payments/latest/refunds/create
 * - https://www.cashfree.com/docs/payments/online/webhooks/signature-verification
 * - https://www.cashfree.com/docs/api-reference/payments/latest/payments/webhooks
 * - https://www.cashfree.com/docs/api-reference/payments/latest/refunds/webhooks
 * - Fees and payment methods: see charges.ts.
 *
 * Re-checked 27 September 2026 against Cashfree's official Node SDK instead,
 * because www.cashfree.com and docs.cashfree.com were blocked from the build
 * machine: `cashfree-pg` 6.0.6 on npm (Apache-2.0,
 * https://github.com/cashfree/cashfree-pg-sdk-nodejs). It confirms the hosts
 * (`https://sandbox.cashfree.com/pg`, `https://api.cashfree.com/pg`), the
 * `x-client-id` / `x-client-secret` / `x-api-version: 2026-01-01` /
 * `x-idempotency-key` headers, the order, payments and refunds paths, and the
 * webhook check in `PGVerifyWebhookSignature`: base64 HMAC-SHA256 of
 * `x-webhook-timestamp + rawBody`, keyed with the client secret (Cashfree has
 * no separate webhook secret). The SDK does not reject old timestamps; the
 * replay window below is ours.
 */

import { createHash, createHmac, randomBytes } from 'node:crypto'
import type {
  ClientConfirmation,
  ConnectionTestResult,
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentMethodKind,
  PaymentProvider,
  PaymentProviderFactory,
  PaymentStatus,
  RefundContext,
  WebhookVerification,
} from '@commerce/payments'
import { safeEqual } from '@commerce/payments'
import { type CfOrderSettlement, type CfPaidPayment, chargesOfPayment } from './charges'
import { type CfWebhookBody, cashfreeEventId, normaliseCashfreeWebhook } from './webhook-events'

export type CashfreeConfig = {
  appId: string
  secretKey: string
  mode: 'test' | 'live'
  /** Shown in the Checkout modal. */
  displayName?: string | undefined
  /** Written by the admin on connect (our webhook URL); sent as `order_meta.notify_url`. */
  notifyUrl?: string | undefined
}

const SANDBOX_HOST = 'https://sandbox.cashfree.com/pg'
const PROD_HOST = 'https://api.cashfree.com/pg'
const API_VERSION = '2026-01-01'

/** Cashfree order id: 3-45 chars, alphanumeric plus `_` and `-`. */
const ORDER_ID_MAX_LEN = 45
/** Cashfree refund id: 3-40 chars. */
const REFUND_ID_MAX_LEN = 40
/** Cashfree order note: 3-200 chars. */
const ORDER_NOTE_MAX_LEN = 200
/** Cashfree order_tags: max 15 keys, each value 1-255 chars. */
const TAG_MAX_LEN = 255
/** Cashfree order_meta.return_url / notify_url: max 250 chars. */
const RETURN_URL_MAX_LEN = 250
/** Cashfree refund_note: 3-100 chars. */
const REFUND_NOTE_MAX_LEN = 100

/** Cashfree's `order_meta.payment_methods` codes for each of our method kinds. */
export const CASHFREE_METHOD_CODES: Record<PaymentMethodKind, string[]> = {
  upi: ['upi'],
  card: ['cc', 'dc', 'ccc', 'ppc'],
  netbanking: ['nb'],
  wallet: ['app'],
  emi: ['paylater', 'cardlessemi', 'dcemi', 'ccemi'],
}

/**
 * Webhooks whose `x-webhook-timestamp` is further than this from our clock are
 * refused, so a captured request can't be replayed later. Our own choice (see
 * the header). Generous because a refused genuine webhook costs little: the
 * unpaid-order expiry asks Cashfree for the status before expiring anything.
 */
export const CASHFREE_WEBHOOK_TOLERANCE_MS = 15 * 60_000

/**
 * UNVERIFIED: Cashfree's samples show a 13-digit (milliseconds) timestamp; a
 * 10-digit value is read as seconds so either unit works.
 */
function webhookTimeMs(raw: string): number | null {
  if (!/^\d{9,13}$/.test(raw)) return null
  const n = Number(raw)
  return raw.length <= 10 ? n * 1000 : n
}

/** Cashfree Checkout's browser SDK, used by the storefront to open the payment session. */
export const CASHFREE_SDK_URL = 'https://sdk.cashfree.com/js/v3/cashfree.js'

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

function sanitiseId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '')
}

function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value
}

/** How long one Cashfree call may take before we give up on it (#1594). */
export const CASHFREE_TIMEOUT_MS = 15_000

/**
 * Cashfree order id: `o<orderNumber>_<first 8 hex chars of orderId>_<attempt>`, or
 * `d<draftNumber>_…` for a checkout draft, sanitised to the characters Cashfree allows and
 * capped at 45 chars. The number keeps ids unique: 8 hex chars alone collide across a busy
 * store's drafts, and Cashfree refuses a repeated order id (#1596).
 */
export function buildCashfreeOrderId(input: CreatePaymentInput): string {
  const numberPart =
    input.orderNumber != null
      ? `o${input.orderNumber}`
      : input.draftNumber != null
        ? `d${input.draftNumber}`
        : 'o'
  const idPart = input.orderId.replace(/-/g, '').slice(0, 8)
  const attempt = input.idempotencyKey?.split(':').at(-1) || '1'
  const raw = `${numberPart}_${idPart}_${attempt}`
  return clip(sanitiseId(raw), ORDER_ID_MAX_LEN)
}

const CASHFREE_ORDER_FAILED_STATUSES = new Set(['EXPIRED', 'TERMINATED', 'TERMINATION_REQUESTED'])

/**
 * Documented `payment_status` values that end a payment without money taken.
 * SUCCESS is captured; PENDING and NOT_ATTEMPTED are still open.
 */
const CASHFREE_PAYMENT_FAILED_STATUSES = new Set(['FAILED', 'USER_DROPPED', 'VOID', 'CANCELLED'])

/**
 * Cashfree documents `x-idempotency-key` as a UUID. Our key (`<orderId>:<attempt>`)
 * maps to the same UUID every time, so a retried request stays idempotent.
 */
function idempotencyUuid(key: string): string {
  const h = createHash('sha256').update(key).digest('hex')
  const variant = ((Number.parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(18, 20)}-${h.slice(20, 32)}`
}

type CfOrderResponse = {
  cf_order_id: string | number
  order_id: string
  payment_session_id: string
  order_status: string
}

type CfOrderStatusResponse = {
  order_status: string
  order_amount: number
  cf_order_id: string | number
}

type CfPayment = {
  cf_payment_id: string | number
  payment_status: string
  payment_amount: number
  is_captured?: boolean
  payment_time?: string
}

type CfRefundResponse = {
  cf_refund_id: string | number
  refund_id: string
  refund_amount: number
  refund_status: string
}

class CashfreeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

/**
 * Cashfree Payment Gateway adapter. Order-first flow: we create a Cashfree
 * order for the amount, the browser opens Cashfree Checkout with the
 * returned payment session id, and the webhook (or a status poll) is the
 * source of truth for the final captured state — Cashfree has no client-side
 * signature to verify like Razorpay's handler payload.
 */
export class CashfreeProvider implements PaymentProvider {
  readonly id: string = 'cashfree'
  readonly label: string = 'UPI, cards, netbanking (Cashfree)'

  constructor(
    protected readonly config: CashfreeConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  get mode(): 'test' | 'live' {
    return this.config.mode
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const host = this.config.mode === 'live' ? PROD_HOST : SANDBOX_HOST
    const init: RequestInit = {
      method,
      headers: {
        'x-client-id': this.config.appId,
        'x-client-secret': this.config.secretKey,
        'x-api-version': API_VERSION,
        'content-type': 'application/json',
        ...extraHeaders,
      },
    }
    if (body !== undefined) init.body = JSON.stringify(body)
    // A stuck connection must not hang checkout, the expiry job or a refund (#1594).
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), CASHFREE_TIMEOUT_MS)
    init.signal = controller.signal
    let res: Response
    let text: string
    try {
      res = await this.fetchImpl(`${host}${path}`, init)
      text = await res.text()
    } catch (err) {
      if (controller.signal.aborted) {
        throw new Error(`Cashfree did not answer in ${CASHFREE_TIMEOUT_MS / 1000}s`)
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
    let json: unknown = {}
    if (text) {
      try {
        json = JSON.parse(text)
      } catch {
        json = {}
      }
    }
    if (!res.ok) {
      const message =
        (json as { message?: string })?.message ?? `Cashfree request failed (${res.status})`
      throw new CashfreeApiError(message, res.status)
    }
    return json as T
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const orderId = buildCashfreeOrderId(input)
    const orderAmount = Number((input.amountPaise / 100).toFixed(2))

    const phoneDigits = digitsOnly(input.customer.phone ?? '')
    if (phoneDigits.length < 10) throw new Error('Cashfree needs a 10-digit phone number')
    const last10 = phoneDigits.slice(-10)

    const customerDetails: Record<string, string> = {
      customer_id: `c${last10}`,
      customer_phone: last10,
    }
    const email = input.customer.email
    if (email && email.length >= 3 && email.length <= 100) customerDetails.customer_email = email
    const name = input.customer.name
    if (name && name.length >= 3 && name.length <= 100) customerDetails.customer_name = name

    const orderMeta: Record<string, string> = {}
    if (input.returnUrl && input.returnUrl.length <= RETURN_URL_MAX_LEN) {
      orderMeta.return_url = input.returnUrl
    }
    // Cashfree only accepts an https notify_url; a local dev worker (http) is left out and
    // the order is confirmed by asking Cashfree instead.
    if (
      this.config.notifyUrl?.startsWith('https://') &&
      this.config.notifyUrl.length <= RETURN_URL_MAX_LEN
    ) {
      orderMeta.notify_url = this.config.notifyUrl
    }
    if (input.methods?.length) {
      orderMeta.payment_methods = input.methods
        .flatMap((m) => CASHFREE_METHOD_CODES[m] ?? [])
        .join(',')
    }

    const tagCandidates: Record<string, string | undefined> = {
      orderId: input.orderId,
      orderNumber: input.orderNumber != null ? String(input.orderNumber) : undefined,
      idempotencyKey: input.idempotencyKey,
    }
    const orderTags: Record<string, string> = {}
    for (const [key, value] of Object.entries(tagCandidates)) {
      if (value) orderTags[key] = clip(value, TAG_MAX_LEN)
    }

    const body: Record<string, unknown> = {
      order_id: orderId,
      order_amount: orderAmount,
      order_currency: input.currency,
      customer_details: customerDetails,
    }
    if (Object.keys(orderMeta).length) body.order_meta = orderMeta
    if (Object.keys(orderTags).length) body.order_tags = orderTags
    if (input.orderNumber != null) {
      body.order_note = clip(`Order ${input.orderNumber}`, ORDER_NOTE_MAX_LEN)
    }

    const extraHeaders: Record<string, string> = {}
    if (input.idempotencyKey)
      extraHeaders['x-idempotency-key'] = idempotencyUuid(input.idempotencyKey)

    const order = await this.request<CfOrderResponse>('POST', '/orders', body, extraHeaders)

    return {
      providerRef: order.order_id,
      status: 'pending',
      session: {
        kind: 'client',
        provider: this.id,
        providerRef: order.order_id,
        publicKey: this.config.appId,
        options: {
          paymentSessionId: order.payment_session_id,
          mode: this.config.mode === 'live' ? 'production' : 'sandbox',
          orderId: order.order_id,
        },
      },
    }
  }

  /** Cashfree has no client-side signature to verify; the order status is the truth. */
  async confirm(
    providerRef: string,
    _confirmation: ClientConfirmation,
  ): Promise<{ status: PaymentStatus; providerPaymentId: string | null }> {
    const s = await this.fetchStatus(providerRef)
    return { status: s.status, providerPaymentId: s.providerPaymentId }
  }

  async fetchStatus(
    providerRef: string,
  ): Promise<{ status: PaymentStatus; providerPaymentId: string | null; amountPaise: number }> {
    const order = await this.request<CfOrderStatusResponse>('GET', `/orders/${providerRef}`)
    const amountPaise = Math.round(order.order_amount * 100)

    if (order.order_status === 'PAID') {
      const payments = await this.request<CfPayment[]>('GET', `/orders/${providerRef}/payments`)
      const success = payments.find((p) => p.payment_status === 'SUCCESS')
      return {
        status: 'captured',
        providerPaymentId: success ? String(success.cf_payment_id) : null,
        amountPaise,
      }
    }
    if (CASHFREE_ORDER_FAILED_STATUSES.has(order.order_status)) {
      return { status: 'failed', providerPaymentId: null, amountPaise }
    }
    // The order stays ACTIVE after a failed try (the shopper may try again in the
    // same window); the latest payment says whether this attempt has ended.
    const payments = await this.request<CfPayment[]>('GET', `/orders/${providerRef}/payments`)
    const success = payments.find((p) => p.payment_status === 'SUCCESS')
    if (success) {
      return { status: 'captured', providerPaymentId: String(success.cf_payment_id), amountPaise }
    }
    const latest = [...payments].sort(
      (a, b) => Date.parse(b.payment_time ?? '') - Date.parse(a.payment_time ?? ''),
    )[0]
    if (latest && CASHFREE_PAYMENT_FAILED_STATUSES.has(latest.payment_status)) {
      return { status: 'failed', providerPaymentId: String(latest.cf_payment_id), amountPaise }
    }
    return { status: 'pending', providerPaymentId: null, amountPaise }
  }

  /**
   * How the payment was paid (the payment) and what Cashfree kept (the order's settlement).
   * The settlement may not exist yet; the fee then stays unknown and the sync asks again.
   */
  async fetchCharges(input: { providerRef: string; providerPaymentId: string }) {
    const order = `/orders/${input.providerRef}`
    const pay = await this.request<CfPaidPayment>(
      'GET',
      `${order}/payments/${input.providerPaymentId}`,
    )
    if (pay.payment_status !== 'SUCCESS') return null
    const settlement = await this.request<CfOrderSettlement>('GET', `${order}/settlements`).catch(
      (err) => {
        if (err instanceof CashfreeApiError && err.status === 404) return null
        throw err
      },
    )
    return chargesOfPayment(pay, settlement, input.providerPaymentId)
  }

  async refund(
    paymentId: string,
    amountPaise: number,
    note?: string,
    context?: RefundContext,
  ): Promise<{ providerRefundId: string; status: 'pending' | 'processed' }> {
    if (!context?.providerRef) throw new Error('Cashfree refunds need the order reference')

    // Cashfree asks for an alphanumeric refund_id (3-40 chars).
    const alnum = (v: string) => v.replace(/[^A-Za-z0-9]/g, '')
    const refundId = context.refundKey
      ? clip(alnum(context.refundKey), REFUND_ID_MAX_LEN)
      : clip(alnum(`rf${paymentId}${Date.now().toString(36)}`), REFUND_ID_MAX_LEN)

    const body: Record<string, unknown> = {
      refund_amount: Number((amountPaise / 100).toFixed(2)),
      refund_id: refundId,
    }
    if (note && note.length >= 3) body.refund_note = clip(note, REFUND_NOTE_MAX_LEN)

    const path = `/orders/${context.providerRef}/refunds`
    const r = await this.request<CfRefundResponse>('POST', path, body).catch(async (err) => {
      // Our own key, refused: the first try may have refunded with its reply lost (#1595).
      // Report that refund when it is for this amount; otherwise the refusal stands.
      if (!context.refundKey || !(err instanceof CashfreeApiError)) throw err
      const existing = await this.request<CfRefundResponse>('GET', `${path}/${refundId}`).catch(
        () => null,
      )
      if (!existing || Math.round(existing.refund_amount * 100) !== amountPaise) throw err
      return existing
    })
    return {
      providerRefundId: String(r.cf_refund_id ?? refundId),
      status: r.refund_status === 'SUCCESS' ? 'processed' : 'pending',
    }
  }

  parseWebhook(input: {
    rawBody: string
    headers: Record<string, string | undefined>
  }): WebhookVerification {
    const signature = input.headers['x-webhook-signature']
    const timestamp = input.headers['x-webhook-timestamp']
    if (!signature || !timestamp) return { ok: false, reason: 'missing signature' }

    const expected = createHmac('sha256', this.config.secretKey)
      .update(`${timestamp}${input.rawBody}`)
      .digest('base64')
    if (!safeEqual(expected, signature)) return { ok: false, reason: 'bad signature' }
    const sentAt = webhookTimeMs(timestamp)
    if (sentAt === null || Math.abs(Date.now() - sentAt) > CASHFREE_WEBHOOK_TOLERANCE_MS) {
      return { ok: false, reason: 'stale timestamp' }
    }

    let body: CfWebhookBody
    try {
      body = JSON.parse(input.rawBody)
    } catch {
      return { ok: false, reason: 'invalid json' }
    }

    // The documented sample nests type/event_time inside `data`; prefer the top-level copy.
    const type = body.type ?? body.data?.type ?? 'unknown'
    const eventId = cashfreeEventId(type, body)
    return { ok: true, eventId, event: normaliseCashfreeWebhook(type, body) }
  }

  /** Read-only probe for the Connect page: a random order id always 404s on valid keys. */
  async testConnection(): Promise<ConnectionTestResult> {
    const probe = `connection-test-${randomBytes(4).toString('hex')}`
    try {
      await this.request('GET', `/orders/${probe}`)
      return { ok: true, message: 'Connected. Cashfree accepted these keys.' }
    } catch (err) {
      if (err instanceof CashfreeApiError) {
        if (err.status === 404) {
          return { ok: true, message: 'Connected. Cashfree accepted these keys.' }
        }
        if (err.status === 401 || err.status === 403) {
          return {
            ok: false,
            message:
              "Cashfree didn't accept these keys. Check the App ID and Secret key, and that Test or Live matches the keys.",
          }
        }
      }
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, message: `Could not reach Cashfree: ${message}` }
    }
  }
}

export const cashfreeFactory: PaymentProviderFactory<CashfreeConfig> = {
  id: 'cashfree',
  label: 'Cashfree',
  fields: [
    { key: 'appId', label: 'App ID', required: true },
    { key: 'secretKey', label: 'Secret key', secret: true, required: true },
    {
      key: 'mode',
      label: 'Test or live',
      help: "'test' uses Cashfree's sandbox, 'live' takes real money",
      hidden: true,
    },
    { key: 'displayName', label: 'Name shown in checkout' },
    { key: 'notifyUrl', label: 'Payment updates URL', hidden: true },
  ],
  methods: ['upi', 'card', 'netbanking', 'wallet', 'emi'],
  validateConfig(raw) {
    const r = (raw ?? {}) as Partial<CashfreeConfig>
    const errors: string[] = []
    if (!r.appId) errors.push('appId is required')
    if (!r.secretKey) errors.push('secretKey is required')
    if (errors.length) return { ok: false, errors }
    return {
      ok: true,
      config: {
        appId: r.appId as string,
        secretKey: r.secretKey as string,
        mode: r.mode === 'live' ? 'live' : 'test',
        displayName: r.displayName,
        notifyUrl: r.notifyUrl,
      },
    }
  },
  create: (config) => new CashfreeProvider(config),
}
