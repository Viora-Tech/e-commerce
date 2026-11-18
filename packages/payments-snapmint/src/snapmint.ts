/**
 * Snapmint cardless EMI, direct (not through Razorpay). Source: Snapmint's "Cardless EMI
 * Integration Document" with checkout 3.0, version 20250722 (shared privately by Snapmint):
 * - 5.1 create checkout `POST /api/pub/carts` on the pay host, from a whitelisted server IP;
 *   the answer's `url` is where the shopper goes.
 * - 6.2 order status, 6.3 refund and partial refund, 6.4 refund status, 8 visibility: the API
 *   host with `Authorization: Bearer <merchant token>`.
 * - 7 webhook (S2S, JSON, three tries, answer 200 at once) and the return post, both with
 *   `checksum_hash` (checksum.ts).
 * Snapmint's EMI offered inside Razorpay Checkout (payments-razorpay SNAPMINT_PROVIDER) is a
 * different thing and is not touched here.
 */
import type {
  AvailabilityInput,
  ClientConfirmation,
  ConnectionTestResult,
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  PaymentProviderFactory,
  PaymentStatus,
  RefundContext,
  WebhookEvent,
  WebhookVerification,
} from '@commerce/payments'
import {
  buildSnapmintCart,
  paiseToRupees,
  rupeesToPaise,
  snapmintMobile,
  VISIBILITY_ORDER_VALUE_CAP,
} from './cart'
import { verifySnapmintChecksum } from './checksum'
import { SnapmintApiError, snapmintRequest } from './http'
import {
  normaliseSnapmintPost,
  type SnapmintPost,
  snapmintEventFromTruth,
  snapmintEventId,
  snapmintPaymentStatus,
} from './status'

export type SnapmintConfig = {
  /** Snapmint's merchant id (MID). */
  merchantId: string
  /** Merchant key: only ever used inside the checksum. */
  merchantKey: string
  /** Merchant token: the API's bearer token and part of the checksum. */
  merchantToken: string
  mode: 'test' | 'live'
}

/** The visibility check gives up this fast; checkout then shows Snapmint (fail open). */
export const SNAPMINT_VISIBILITY_TIMEOUT_MS = 1_500

/** Snapmint's merchant refund id: ours, letters and digits (no length rule is documented). */
const REFUND_ID_MAX_LEN = 40

type CartResponse = { url?: string }
type OrderStatusResponse = { order_status?: string; snapmint_id?: string | number | null }
type RefundResponse = {
  refund_id?: string | number
  merchant_refund_id?: string
  refund_status?: string
  message?: string
}
type RefundStatusResponse = {
  refund_array?: {
    refund_id?: string | number
    refund_amount?: number | string
    status?: string
    merchant_refund_id?: string
  }[]
}

const refundState = (s: string | undefined): 'pending' | 'processed' | 'failed' => {
  const v = (s ?? '').toLowerCase()
  return v === 'completed' ? 'processed' : v === 'rejected' ? 'failed' : 'pending'
}

export class SnapmintProvider implements PaymentProvider {
  readonly id = 'snapmint'
  readonly label = 'Snapmint · EMI on UPI & cards, no credit card needed'

  constructor(
    private readonly config: SnapmintConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  get mode(): 'test' | 'live' {
    return this.config.mode
  }

  private call<T>(call: Parameters<typeof snapmintRequest>[2]): Promise<T> {
    return snapmintRequest<T>(this.fetchImpl, this.config, call)
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const body = buildSnapmintCart(input, this.config.merchantId)
    const ref = String(body.merchantOrderId)
    const res = await this.call<CartResponse>({
      host: 'pay',
      method: 'POST',
      path: '/api/pub/carts',
      body,
      auth: false,
    })
    if (!res.url?.startsWith('https://')) throw new Error('Snapmint did not return a checkout link')
    return {
      providerRef: ref,
      status: 'pending',
      session: { kind: 'redirect', provider: this.id, providerRef: ref, url: res.url },
    }
  }

  /** Section 6.2. A 404 (SNM0002) is an order Snapmint has no record of yet. */
  private async orderStatus(
    ref: string,
  ): Promise<{ orderStatus: string; snapmintId: string | null }> {
    try {
      const r = await this.call<OrderStatusResponse>({
        host: 'api',
        method: 'GET',
        path: '/v1/merchants/orders/order_status',
        query: { order_id: ref },
      })
      const id = r.snapmint_id
      return {
        orderStatus: String(r.order_status ?? 'PENDING_STATUS'),
        snapmintId: id === null || id === undefined || id === '' ? null : String(id),
      }
    } catch (err) {
      if (err instanceof SnapmintApiError && (err.status === 404 || err.code === 'SNM0002')) {
        return { orderStatus: 'NOT_FOUND', snapmintId: null }
      }
      throw err
    }
  }

  /** Snapmint's order status API; it reports no amount, so `amountPaise` is 0 (unused by callers). */
  async fetchStatus(
    providerRef: string,
  ): Promise<{ status: PaymentStatus; providerPaymentId: string | null; amountPaise: number }> {
    const truth = await this.orderStatus(providerRef)
    const status = snapmintPaymentStatus(truth.orderStatus) ?? 'pending'
    const paid = status === 'captured' || status === 'authorized' || status === 'refunded'
    return {
      status,
      providerPaymentId: paid ? (truth.snapmintId ?? providerRef) : null,
      amountPaise: 0,
    }
  }

  /** The shopper is back: whatever the post says, the order status API decides. */
  async confirm(
    providerRef: string,
    _confirmation: ClientConfirmation,
  ): Promise<{ status: PaymentStatus; providerPaymentId: string | null }> {
    const s = await this.fetchStatus(providerRef)
    return { status: s.status, providerPaymentId: s.providerPaymentId }
  }

  parseReturn(fields: Record<string, string>): { providerRef: string; verified: boolean } | null {
    const providerRef = (fields.order_id ?? '').trim()
    if (!providerRef) return null
    return { providerRef, verified: verifySnapmintChecksum(this.config, fields) }
  }

  parseWebhook(input: {
    rawBody: string
    headers: Record<string, string | undefined>
  }): WebhookVerification {
    let post: SnapmintPost
    try {
      const parsed: unknown = JSON.parse(input.rawBody)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ok: false, reason: 'invalid json' }
      }
      post = parsed as SnapmintPost
    } catch {
      return { ok: false, reason: 'invalid json' }
    }
    if (!verifySnapmintChecksum(this.config, post)) return { ok: false, reason: 'bad checksum' }
    if (!post.order_id) return { ok: false, reason: 'no order id' }
    return { ok: true, eventId: snapmintEventId(post), event: normaliseSnapmintPost(post) }
  }

  /** The post said success or failure; the order status API says what actually happened. */
  async confirmWebhookEvent(event: WebhookEvent): Promise<WebhookEvent> {
    if (event.type !== 'payment.captured' && event.type !== 'payment.failed') return event
    return snapmintEventFromTruth(event, await this.orderStatus(event.providerRef))
  }

  /**
   * Section 6.3: refunds and part refunds (one call each). `merchant_refund_id` is our refund
   * row's key, so a retry after a lost reply finds the first refund instead of a second one.
   */
  async refund(
    paymentId: string,
    amountPaise: number,
    _note?: string,
    context?: RefundContext,
  ): Promise<{ providerRefundId: string; status: 'pending' | 'processed' }> {
    const orderId = context?.providerRef ?? paymentId
    const merchantRefundId = (context?.refundKey ?? `rf${orderId}${Date.now().toString(36)}`)
      .replace(/[^A-Za-z0-9_]/g, '')
      .slice(0, REFUND_ID_MAX_LEN)
    const r = await this.call<RefundResponse>({
      host: 'api',
      method: 'POST',
      path: '/v1/merchants/orders/refund_order',
      body: {
        order_id: orderId,
        refund_amount: paiseToRupees(amountPaise),
        merchant_refund_id: merchantRefundId,
      },
    }).catch(async (err: unknown) => {
      // SNM0020 duplicate merchant refund id: the first try went through and its reply was lost.
      if (!(err instanceof SnapmintApiError) || err.code !== 'SNM0020') throw err
      const found = await this.findRefund({ merchantRefundId })
      if (!found || rupeesToPaise(found.refund_amount) !== amountPaise) throw err
      return { refund_id: found.refund_id, refund_status: found.status } as RefundResponse
    })
    const state = refundState(r.refund_status)
    if (state === 'failed') throw new Error(r.message || 'Snapmint rejected the refund')
    return {
      providerRefundId: String(r.refund_id ?? merchantRefundId),
      status: state === 'processed' ? 'processed' : 'pending',
    }
  }

  private async findRefund(by: { refundId?: string; merchantRefundId?: string }) {
    const query: Record<string, string> = by.refundId
      ? { refund_id: by.refundId }
      : { merchant_refund_id: by.merchantRefundId ?? '' }
    const r = await this.call<RefundStatusResponse>({
      host: 'api',
      method: 'GET',
      path: '/v1/merchants/orders/refund_status',
      query,
    })
    return (
      (r.refund_array ?? []).find((x) =>
        by.refundId
          ? String(x.refund_id) === by.refundId
          : x.merchant_refund_id === by.merchantRefundId,
      ) ?? null
    )
  }

  /** Section 6.4, asked daily by the worker's refund sync while a refund is pending. */
  async fetchRefundStatus(input: {
    providerRefundId: string
    providerRef: string
  }): Promise<'pending' | 'processed' | 'failed'> {
    const found = await this.findRefund({ refundId: input.providerRefundId })
    return refundState(found?.status)
  }

  /**
   * Section 8: whether Snapmint would offer this shopper EMI at all. Built for order values up
   * to ₹10,000 (more is sent as 10,000). Any error or a slow answer shows Snapmint (fail open):
   * the lender still decides on its own page.
   */
  async checkAvailability(input: AvailabilityInput): Promise<boolean> {
    const mobile = snapmintMobile(input.customer.phone)
    if (!mobile) return false
    const ship = input.shipping
    const body: Record<string, unknown> = {
      mobile: Number(mobile),
      order_value: Math.min(Math.round(input.amountPaise / 100), VISIBILITY_ORDER_VALUE_CAP),
      full_name: input.customer.name ?? ship?.name ?? '',
      email: input.customer.email ?? '',
    }
    if (ship) {
      body.shipping_zip = Number(ship.postalCode.replace(/\D/g, ''))
      body.shipping_address_line1 = ship.line1
      if (ship.line2) body.shipping_address_line2 = ship.line2
      body.shipping_city = ship.city
      body.shipping_state = ship.stateName ?? ship.state
    }
    try {
      const r = await this.call<{ visible?: unknown }>({
        host: 'api',
        method: 'POST',
        path: '/v1/merchants/orders/check_visibility',
        body,
        timeoutMs: SNAPMINT_VISIBILITY_TIMEOUT_MS,
      })
      return r.visible !== false
    } catch {
      return true
    }
  }

  /** Read-only: an order id that cannot exist answers 404 on a good token, 401 on a bad one. */
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      await this.call({
        host: 'api',
        method: 'GET',
        path: '/v1/merchants/orders/order_status',
        query: { order_id: `connection-test-${Date.now().toString(36)}` },
      })
      return { ok: true, message: 'Connected. Snapmint accepted this merchant token.' }
    } catch (err) {
      if (err instanceof SnapmintApiError) {
        if (err.status === 404 || err.code === 'SNM0002') {
          return { ok: true, message: 'Connected. Snapmint accepted this merchant token.' }
        }
        if (err.status === 401 || err.code === 'SNM0001') {
          return {
            ok: false,
            message:
              "Snapmint didn't accept this merchant token. Check it, and that Sandbox or Live matches it.",
          }
        }
      }
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, message: `Could not reach Snapmint: ${message}` }
    }
  }
}

export const snapmintFactory: PaymentProviderFactory<SnapmintConfig> = {
  id: 'snapmint',
  label: 'Snapmint',
  fields: [
    { key: 'merchantId', label: 'Merchant ID', required: true },
    { key: 'merchantKey', label: 'Merchant key', secret: true, required: true },
    { key: 'merchantToken', label: 'Merchant token', secret: true, required: true },
    {
      key: 'mode',
      label: 'Sandbox or live',
      help: "'test' uses Snapmint's sandbox, 'live' takes real money",
      hidden: true,
    },
  ],
  methods: ['emi'],
  validateConfig(raw) {
    const r = (raw ?? {}) as Partial<Record<keyof SnapmintConfig, string>>
    const errors: string[] = []
    if (!r.merchantId?.trim()) errors.push('merchantId is required')
    if (!r.merchantKey) errors.push('merchantKey is required')
    if (!r.merchantToken) errors.push('merchantToken is required')
    if (errors.length) return { ok: false, errors }
    return {
      ok: true,
      config: {
        merchantId: (r.merchantId as string).trim(),
        merchantKey: r.merchantKey as string,
        merchantToken: r.merchantToken as string,
        mode: r.mode === 'live' ? 'live' : 'test',
      },
    }
  },
  create: (config) => new SnapmintProvider(config),
}
