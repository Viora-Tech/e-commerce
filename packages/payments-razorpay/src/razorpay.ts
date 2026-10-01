import { createHmac } from 'node:crypto'
import type {
  ClientConfirmation,
  ConnectionTestResult,
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentMethodKind,
  PaymentProvider,
  PaymentProviderFactory,
  PaymentStatus,
  WebhookEvent,
  WebhookVerification,
} from '@commerce/payments'
import { safeEqual } from '@commerce/payments'
import Razorpay from 'razorpay'
import { refreshOAuthConfig } from './oauth'

export type RazorpayConfig = {
  /** API key id, or the OAuth `public_token` (rzp_test_oauth_...) when connected with OAuth. */
  keyId: string
  /** API key secret. Empty when connected with OAuth. */
  keySecret: string
  webhookSecret: string
  /** OAuth access token (Bearer); set only for "Connect Razorpay" connections. */
  accessToken?: string | undefined
  /** Shown in the Checkout modal. */
  displayName?: string | undefined
  /** Surface EMI (Snapmint cardless EMI first) as its own block at the top of Checkout. */
  enableEmi?: boolean | undefined
}

/** True for a "Connect Razorpay" (OAuth) connection rather than pasted API keys. */
export const isOAuthConfig = (c: Pick<RazorpayConfig, 'accessToken'>): boolean =>
  Boolean(c.accessToken)

/** Test or live, from the key id Razorpay issued (`rzp_test_...`, `rzp_live_...`, `rzp_test_oauth_...`). */
export function razorpayMode(keyId: string | undefined): 'test' | 'live' | null {
  if (!keyId) return null
  if (keyId.startsWith('rzp_test_')) return 'test'
  if (keyId.startsWith('rzp_live_')) return 'live'
  return null
}

/** Razorpay caps order notes at 15 keys, 256 characters per value. */
const NOTES_MAX_KEYS = 15
const NOTE_MAX_LEN = 256

/** Razorpay cardless-EMI provider code for Snapmint. Enabled from the Razorpay dashboard, no extra API. */
export const SNAPMINT_PROVIDER = 'snapmint'

function clip(value: string | undefined): string | undefined {
  if (!value) return undefined
  return value.length > NOTE_MAX_LEN ? value.slice(0, NOTE_MAX_LEN) : value
}

/**
 * Notes travel with the Razorpay order to lenders (Snapmint et al) and show in
 * the dashboard. Address is flattened, the basket is one compact line.
 */
export function buildOrderNotes(input: CreatePaymentInput): Record<string, string> {
  const s = input.shipping
  const basket = input.lines
    ?.map((l) => `${l.quantity}x ${l.title} @${(l.unitPricePaise / 100).toFixed(2)}`)
    .join('; ')
  const candidates: Record<string, string | undefined> = {
    orderId: input.orderId,
    orderNumber: input.orderNumber != null ? String(input.orderNumber) : undefined,
    // Echoed back on every payment webhook, so an attempt can be matched even if
    // recording the Razorpay order id failed after the API call.
    idempotencyKey: input.idempotencyKey,
    shipping_name: s?.name,
    shipping_line1: s?.line1,
    shipping_line2: s?.line2,
    shipping_city: s?.city,
    shipping_state: s?.state,
    shipping_postal_code: s?.postalCode,
    shipping_country: s?.country,
    basket,
  }
  const notes: Record<string, string> = {}
  for (const [k, v] of Object.entries(candidates)) {
    const c = clip(v)
    if (c !== undefined) notes[k] = c
    if (Object.keys(notes).length === NOTES_MAX_KEYS) break
  }
  return notes
}

/** Razorpay caps `receipt` at 40 characters. */
const RECEIPT_MAX_LEN = 40

/**
 * The receipt merchants see in the Razorpay dashboard: `order-1042`, and
 * `order-1042-2` for the second attempt. Razorpay has no idempotency header for
 * orders, so our own dedupe (one gateway call per attempt row) does that job.
 */
export function buildReceipt(input: CreatePaymentInput): string {
  const attempt = input.idempotencyKey?.split(':').at(-1)
  const base = input.orderNumber != null ? `order-${input.orderNumber}` : input.orderId
  const receipt = attempt && attempt !== '1' ? `${base}-${attempt}` : base
  return receipt.slice(0, RECEIPT_MAX_LEN)
}

/** Checkout blocks for each merchant-facing method; EMI also carries Snapmint cardless EMI. */
const METHOD_BLOCKS: Record<
  PaymentMethodKind,
  { name: string; instruments: Record<string, unknown>[] }
> = {
  upi: { name: 'Pay using UPI', instruments: [{ method: 'upi' }] },
  card: { name: 'Cards', instruments: [{ method: 'card' }] },
  netbanking: { name: 'Netbanking', instruments: [{ method: 'netbanking' }] },
  wallet: { name: 'Wallets', instruments: [{ method: 'wallet' }] },
  emi: {
    name: 'Pay in EMIs',
    instruments: [{ method: 'cardless_emi', providers: [SNAPMINT_PROVIDER] }, { method: 'emi' }],
  },
}

/**
 * Checkout `config.display` for the merchant's method row: one block per method
 * turned on, in their order, and Razorpay's default blocks switched off so
 * nothing else shows. `blocks`, `sequence` and `preferences.show_default_blocks`
 * are Razorpay's documented Checkout options
 * (https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/configure-payment-methods/sample-code/).
 */
export function buildMethodDisplayConfig(methods: PaymentMethodKind[]): Record<string, unknown> {
  const blocks: Record<string, unknown> = {}
  const sequence: string[] = []
  for (const m of methods) {
    const block = METHOD_BLOCKS[m]
    if (!block || blocks[m]) continue
    blocks[m] = block
    sequence.push(`block.${m}`)
  }
  return { display: { blocks, sequence, preferences: { show_default_blocks: false } } }
}

/**
 * Checkout `config.display`. With EMI on, a "Pay in EMIs" block leads with
 * Snapmint (cardless) then card EMI; default blocks still follow.
 */
export function buildDisplayConfig(enableEmi: boolean | undefined): Record<string, unknown> {
  if (!enableEmi) return { display: { preferences: { show_default_blocks: true } } }
  return {
    display: {
      blocks: {
        emi: {
          name: 'Pay in EMIs',
          instruments: [
            { method: 'cardless_emi', providers: [SNAPMINT_PROVIDER] },
            { method: 'emi' },
          ],
        },
      },
      sequence: ['block.emi'],
      preferences: { show_default_blocks: true },
    },
  }
}

const RAZORPAY_STATUS: Record<string, PaymentStatus> = {
  created: 'pending',
  authorized: 'authorized',
  captured: 'captured',
  refunded: 'refunded',
  failed: 'failed',
}

function hmacHex(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex')
}

export type RzpPayment = {
  id: string
  order_id?: string | null
  amount: number
  status: string
  error_description?: string | null
  notes?: Record<string, string> | null
}

/** Razorpay's QR code entity, the fields we read. Notes may arrive as `[]` when empty. */
export type RzpQrCode = {
  id: string
  status: string
  image_url: string
  payment_amount?: number | null
  payments_amount_received?: number | null
  close_by?: number | null
  close_reason?: string | null
  notes?: Record<string, string> | null
}

type RzpWebhookBody = {
  event?: string
  payload?: {
    payment?: { entity?: RzpPayment }
    refund?: { entity?: { id: string; amount: number; payment_id: string } }
    qr_code?: { entity?: RzpQrCode }
  }
}

/** A QR closes as `paid` once its single payment lands; that close is not a failure. */
export function qrWasPaid(qr: RzpQrCode): boolean {
  if (qr.close_reason === 'paid') return true
  const due = Number(qr.payment_amount ?? 0)
  return due > 0 && Number(qr.payments_amount_received ?? 0) >= due
}

/**
 * Razorpay adapter. Order-first flow: we create a Razorpay order for the
 * amount, the browser opens Checkout with that order id, the handler posts
 * back the payment id + signature which `confirm` verifies, and the webhook
 * is the source of truth for the final captured state.
 */
export class RazorpayProvider implements PaymentProvider {
  readonly id: string = 'razorpay'
  readonly label: string = 'UPI, cards, netbanking (Razorpay)'
  protected readonly client: Razorpay

  constructor(protected readonly config: RazorpayConfig) {
    // An OAuth connection calls the API as the merchant with a Bearer token;
    // pasted keys use basic auth. The SDK supports both (`oauthToken`).
    this.client = isOAuthConfig(config)
      ? new Razorpay({ oauthToken: config.accessToken as string })
      : new Razorpay({ key_id: config.keyId, key_secret: config.keySecret })
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const order = await this.client.orders.create({
      amount: input.amountPaise,
      currency: input.currency,
      receipt: buildReceipt(input),
      payment_capture: true,
      notes: buildOrderNotes(input),
    })
    return {
      providerRef: order.id,
      status: 'pending',
      session: {
        kind: 'client',
        provider: this.id,
        providerRef: order.id,
        publicKey: this.config.keyId,
        options: {
          key: this.config.keyId,
          order_id: order.id,
          amount: input.amountPaise,
          currency: input.currency,
          name: this.config.displayName ?? 'Checkout',
          prefill: {
            email: input.customer.email,
            contact: input.customer.phone,
            name: input.customer.name,
          },
          // UPI intent on mobile, dynamic QR on desktop; Checkout decides by device.
          config: input.methods?.length
            ? buildMethodDisplayConfig(input.methods)
            : buildDisplayConfig(this.config.enableEmi),
        },
      },
    }
  }

  /** Verifies Checkout's handler payload: HMAC(order_id|payment_id) with the key secret. */
  async confirm(
    providerRef: string,
    confirmation: ClientConfirmation,
  ): Promise<{ status: PaymentStatus; providerPaymentId: string | null }> {
    const paymentId = confirmation.razorpay_payment_id
    const signature = confirmation.razorpay_signature
    if (!paymentId || !signature) return { status: 'pending' as const, providerPaymentId: null }
    if (isOAuthConfig(this.config)) {
      // No key secret to check the handler signature with: ask Razorpay (as
      // the merchant) and trust only a payment that belongs to this order.
      const p = (await this.client.payments.fetch(paymentId)) as unknown as RzpPayment
      if (p.order_id !== providerRef) return { status: 'failed' as const, providerPaymentId: null }
      return { status: RAZORPAY_STATUS[p.status] ?? 'pending', providerPaymentId: p.id }
    }
    const expected = hmacHex(this.config.keySecret, `${providerRef}|${paymentId}`)
    if (!safeEqual(expected, signature))
      return { status: 'failed' as const, providerPaymentId: paymentId }
    const p = (await this.client.payments.fetch(paymentId)) as unknown as RzpPayment
    return { status: RAZORPAY_STATUS[p.status] ?? 'pending', providerPaymentId: p.id }
  }

  async fetchStatus(providerRef: string) {
    const res = (await this.client.orders.fetchPayments(providerRef)) as unknown as {
      items: RzpPayment[]
    }
    const order = (await this.client.orders.fetch(providerRef)) as unknown as { amount: number }
    const best = res.items.find((p) => p.status === 'captured') ?? res.items[0]
    return {
      status: best ? (RAZORPAY_STATUS[best.status] ?? 'pending') : ('pending' as PaymentStatus),
      providerPaymentId: best?.id ?? null,
      amountPaise: Number(order.amount),
    }
  }

  /** "Test connection": lists one order, which needs working keys and creates nothing. */
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      await this.client.orders.all({ count: 1 })
      return { ok: true, message: 'Connected. Razorpay accepted these keys.' }
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      if (status === 401) {
        return {
          ok: false,
          message:
            "Razorpay didn't accept these keys. Copy the Key ID and Key secret again, both from the same mode (Test or Live).",
        }
      }
      const detail = (err as { error?: { description?: string } }).error?.description
      return {
        ok: false,
        message: `Couldn't reach Razorpay${detail ? `: ${detail}` : '. Try again in a minute.'}`,
      }
    }
  }

  async refund(providerPaymentId: string, amountPaise: number, note?: string) {
    const r = (await this.client.payments.refund(providerPaymentId, {
      amount: amountPaise,
      notes: note ? { note } : undefined,
    })) as unknown as { id: string; status: string }
    return {
      providerRefundId: r.id,
      status: r.status === 'processed' ? ('processed' as const) : ('pending' as const),
    }
  }

  parseWebhook(input: {
    rawBody: string
    headers: Record<string, string | undefined>
  }): WebhookVerification {
    const signature = input.headers['x-razorpay-signature']
    if (!signature) return { ok: false, reason: 'missing signature' }
    if (!safeEqual(hmacHex(this.config.webhookSecret, input.rawBody), signature)) {
      return { ok: false, reason: 'bad signature' }
    }
    let body: RzpWebhookBody
    try {
      body = JSON.parse(input.rawBody)
    } catch {
      return { ok: false, reason: 'invalid json' }
    }
    // Deduplicated on what the signature covers (event + entity id). The event-id header is
    // not signed, so a replayed body with a new header would otherwise count as new.
    const entityId =
      body.payload?.payment?.entity?.id ??
      body.payload?.refund?.entity?.id ??
      body.payload?.qr_code?.entity?.id
    const eventId = entityId
      ? `${body.event}:${entityId}`
      : (input.headers['x-razorpay-event-id'] ?? `${body.event}:unknown`)
    return { ok: true, eventId, event: this.normalise(body) }
  }

  /**
   * Checkout payments always belong to a Razorpay order we created (`providerRef`); one
   * without an order was made outside our checkout (anyone can open Checkout with the
   * public key id and put an attempt's `idempotencyKey` in its notes), so it is ignored.
   */
  private normalise(body: RzpWebhookBody): WebhookEvent {
    const pay = body.payload?.payment?.entity
    const qr = body.payload?.qr_code?.entity
    const orderId = pay?.notes?.orderId ?? qr?.notes?.orderId ?? null
    const idempotencyKey = pay?.notes?.idempotencyKey ?? qr?.notes?.idempotencyKey ?? null
    switch (body.event) {
      // A single-use UPI QR was paid: the QR id is the attempt's reference.
      case 'qr_code.credited':
        if (!pay || !qr) break
        return {
          type: 'payment.captured',
          providerRef: qr.id,
          providerPaymentId: pay.id,
          idempotencyKey,
          amountPaise: Number(pay.amount),
          orderId,
          raw: body,
        }
      // Closed unpaid (expired or closed by hand): the attempt failed, the shopper can get a new QR.
      case 'qr_code.closed':
        if (!qr || qrWasPaid(qr)) break
        return {
          type: 'payment.failed',
          providerRef: qr.id,
          providerPaymentId: null,
          idempotencyKey,
          reason: `UPI QR closed unpaid (${qr.close_reason ?? 'expired'})`,
          orderId,
          raw: body,
        }
      case 'payment.captured':
        if (!pay?.order_id) break
        return {
          type: 'payment.captured',
          providerRef: pay.order_id ?? '',
          providerPaymentId: pay.id,
          idempotencyKey,
          amountPaise: Number(pay.amount),
          orderId,
          raw: body,
        }
      case 'payment.authorized':
        if (!pay?.order_id) break
        return {
          type: 'payment.authorized',
          providerRef: pay.order_id ?? '',
          providerPaymentId: pay.id,
          idempotencyKey,
          amountPaise: Number(pay.amount),
          orderId,
          raw: body,
        }
      case 'payment.failed':
        if (!pay?.order_id) break
        return {
          type: 'payment.failed',
          providerRef: pay.order_id ?? '',
          providerPaymentId: pay.id,
          idempotencyKey,
          reason: pay.error_description ?? 'failed',
          orderId,
          raw: body,
        }
      case 'refund.processed': {
        const r = body.payload?.refund?.entity
        if (!r) break
        return {
          type: 'refund.processed',
          providerRef: pay?.order_id ?? '',
          providerRefundId: r.id,
          amountPaise: Number(r.amount),
          orderId,
          raw: body,
        }
      }
    }
    return { type: 'ignored', eventName: body.event ?? 'unknown', raw: body }
  }
}

export const razorpayFactory: PaymentProviderFactory<RazorpayConfig> = {
  id: 'razorpay',
  label: 'Razorpay',
  methods: ['upi', 'card', 'netbanking', 'wallet', 'emi'],
  fields: [
    { key: 'keyId', label: 'Key ID', required: true },
    { key: 'keySecret', label: 'Key secret', secret: true },
    {
      key: 'webhookSecret',
      label: 'Webhook secret',
      secret: true,
      required: true,
      help: 'Set the same value in the Razorpay dashboard webhook.',
    },
    { key: 'displayName', label: 'Name shown in checkout' },
    {
      key: 'enableEmi',
      label: 'Offer EMI (Snapmint cardless EMI, card EMI)',
      type: 'boolean',
      help: 'Turn Snapmint on under Razorpay Dashboard > Payment Methods first; this only moves EMI to the top of Checkout.',
    },
    // Written by "Connect Razorpay" (OAuth), never typed in; hidden from forms.
    { key: 'accessToken', label: 'Access token', secret: true, hidden: true },
    { key: 'refreshToken', label: 'Refresh token', secret: true, hidden: true },
    { key: 'accessExpiresAt', label: 'Access expires', hidden: true },
    { key: 'accountId', label: 'Razorpay account', hidden: true },
    { key: 'oauthMode', label: 'Connected in', hidden: true },
    { key: 'webhookId', label: 'Webhook id', hidden: true },
  ],
  validateConfig(raw) {
    const r = (raw ?? {}) as Partial<Omit<RazorpayConfig, 'enableEmi'>> & {
      enableEmi?: boolean | string | undefined
    }
    const errors: string[] = []
    const oauth = Boolean(r.accessToken)
    if (!r.keyId?.startsWith('rzp_')) errors.push('keyId must start with rzp_')
    if (!oauth && !r.keySecret) errors.push('keySecret is required')
    if (!r.webhookSecret) errors.push('webhookSecret is required')
    if (errors.length) return { ok: false, errors }
    return {
      ok: true,
      config: {
        keyId: r.keyId as string,
        keySecret: r.keySecret ?? '',
        webhookSecret: r.webhookSecret as string,
        accessToken: oauth ? r.accessToken : undefined,
        displayName: r.displayName,
        enableEmi: r.enableEmi === true || r.enableEmi === 'true',
      },
    }
  },
  refreshCredentials: (saved, now) => refreshOAuthConfig(saved, process.env, fetch, now),
  create: (config) => new RazorpayProvider(config),
}
