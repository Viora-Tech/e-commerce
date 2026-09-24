import type {
  CreatePaymentInput,
  PaymentProvider,
  PaymentStatus,
  WebhookEvent,
} from '@commerce/payments'

/* Test-only gateway for the payments suites. */

export type Delivery = {
  eventId: string
  type: 'payment.captured' | 'payment.failed'
  providerRef: string
  idempotencyKey?: string
}

/**
 * A Razorpay-shaped gateway without the network: orders are created pending,
 * and webhooks are JSON bodies signed with a header. Mirrors the real adapter's
 * shape so the platform code runs unchanged.
 */
export class GatewayDouble implements PaymentProvider {
  readonly id = 'gw'
  readonly label = 'Gateway double'
  readonly created: CreatePaymentInput[] = []
  failNext = false
  /** Makes `fetchStatus` throw, as when the gateway is down. */
  fetchFails = false
  readonly status = new Map<string, PaymentStatus>()

  async createPayment(input: CreatePaymentInput) {
    if (this.failNext) {
      this.failNext = false
      throw new Error('gateway timeout')
    }
    this.created.push(input)
    const providerRef = `order_${this.created.length}`
    return {
      providerRef,
      status: 'pending' as const,
      session: {
        kind: 'client' as const,
        provider: this.id,
        providerRef,
        publicKey: 'pk',
        options: {},
      },
    }
  }
  async confirm() {
    return { status: 'pending' as const, providerPaymentId: null }
  }
  async fetchStatus(ref: string) {
    if (this.fetchFails) throw new Error('gateway down')
    return { status: this.status.get(ref) ?? 'pending', providerPaymentId: null, amountPaise: 0 }
  }
  async refund() {
    return { providerRefundId: 'rf', status: 'processed' as const }
  }
  parseWebhook({
    rawBody,
    headers,
  }: {
    rawBody: string
    headers: Record<string, string | undefined>
  }) {
    if (headers.sig !== 'ok') return { ok: false as const, reason: 'bad signature' }
    const d = JSON.parse(rawBody) as Delivery
    const event: WebhookEvent =
      d.type === 'payment.captured'
        ? {
            type: d.type,
            providerRef: d.providerRef,
            idempotencyKey: d.idempotencyKey ?? null,
            providerPaymentId: `pay_${d.eventId}`,
            amountPaise: 100,
            orderId: null,
            raw: d,
          }
        : {
            type: d.type,
            providerRef: d.providerRef,
            idempotencyKey: d.idempotencyKey ?? null,
            providerPaymentId: `pay_${d.eventId}`,
            reason: 'declined',
            orderId: null,
            raw: d,
          }
    return { ok: true as const, eventId: d.eventId, event }
  }
}
