import { createHmac, timingSafeEqual } from 'node:crypto'
import type {
  ClientConfirmation,
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  PaymentProviderFactory,
  PaymentStatus,
  WebhookEvent,
  WebhookVerification,
} from '@commerce/payments'
import Razorpay from 'razorpay'

export type RazorpayConfig = {
  keyId: string
  keySecret: string
  webhookSecret: string
  /** Shown in the Checkout modal. */
  displayName?: string | undefined
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

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

type RzpPayment = {
  id: string
  order_id?: string | null
  amount: number
  status: string
  error_description?: string | null
  notes?: Record<string, string> | null
}

/**
 * Razorpay adapter. Order-first flow: we create a Razorpay order for the
 * amount, the browser opens Checkout with that order id, the handler posts
 * back the payment id + signature which `confirm` verifies, and the webhook
 * is the source of truth for the final captured state.
 */
export class RazorpayProvider implements PaymentProvider {
  readonly id = 'razorpay'
  readonly label = 'UPI, cards, netbanking (Razorpay)'
  private readonly client: Razorpay

  constructor(private readonly config: RazorpayConfig) {
    this.client = new Razorpay({ key_id: config.keyId, key_secret: config.keySecret })
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const order = await this.client.orders.create({
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.orderNumber != null ? `order-${input.orderNumber}` : input.orderId,
      payment_capture: true,
      notes: { orderId: input.orderId },
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
          config: { display: { preferences: { show_default_blocks: true } } },
        },
      },
    }
  }

  /** Verifies Checkout's handler payload: HMAC(order_id|payment_id) with the key secret. */
  async confirm(providerRef: string, confirmation: ClientConfirmation) {
    const paymentId = confirmation.razorpay_payment_id
    const signature = confirmation.razorpay_signature
    if (!paymentId || !signature) return { status: 'pending' as const, providerPaymentId: null }
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
    let body: {
      event?: string
      payload?: {
        payment?: { entity?: RzpPayment }
        refund?: { entity?: { id: string; amount: number; payment_id: string } }
      }
    }
    try {
      body = JSON.parse(input.rawBody)
    } catch {
      return { ok: false, reason: 'invalid json' }
    }
    const eventId =
      input.headers['x-razorpay-event-id'] ??
      `${body.event}:${body.payload?.payment?.entity?.id ?? body.payload?.refund?.entity?.id ?? 'unknown'}`
    return { ok: true, eventId, event: this.normalise(body) }
  }

  private normalise(body: {
    event?: string
    payload?: {
      payment?: { entity?: RzpPayment }
      refund?: { entity?: { id: string; amount: number; payment_id: string } }
    }
  }): WebhookEvent {
    const pay = body.payload?.payment?.entity
    const orderId = pay?.notes?.orderId ?? null
    switch (body.event) {
      case 'payment.captured':
        if (!pay) break
        return {
          type: 'payment.captured',
          providerRef: pay.order_id ?? '',
          providerPaymentId: pay.id,
          amountPaise: Number(pay.amount),
          orderId,
          raw: body,
        }
      case 'payment.authorized':
        if (!pay) break
        return {
          type: 'payment.authorized',
          providerRef: pay.order_id ?? '',
          providerPaymentId: pay.id,
          amountPaise: Number(pay.amount),
          orderId,
          raw: body,
        }
      case 'payment.failed':
        if (!pay) break
        return {
          type: 'payment.failed',
          providerRef: pay.order_id ?? '',
          providerPaymentId: pay.id,
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
  fields: [
    { key: 'keyId', label: 'Key ID', required: true },
    { key: 'keySecret', label: 'Key secret', secret: true, required: true },
    {
      key: 'webhookSecret',
      label: 'Webhook secret',
      secret: true,
      required: true,
      help: 'Set the same value in the Razorpay dashboard webhook.',
    },
    { key: 'displayName', label: 'Name shown in checkout' },
  ],
  validateConfig(raw) {
    const r = (raw ?? {}) as Partial<RazorpayConfig>
    const errors: string[] = []
    if (!r.keyId?.startsWith('rzp_')) errors.push('keyId must start with rzp_')
    if (!r.keySecret) errors.push('keySecret is required')
    if (!r.webhookSecret) errors.push('webhookSecret is required')
    if (errors.length) return { ok: false, errors }
    return {
      ok: true,
      config: {
        keyId: r.keyId as string,
        keySecret: r.keySecret as string,
        webhookSecret: r.webhookSecret as string,
        displayName: r.displayName,
      },
    }
  },
  create: (config) => new RazorpayProvider(config),
}
