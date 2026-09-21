import type {
  ClientConfirmation,
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  PaymentStatus,
  WebhookVerification,
} from '@commerce/payments'

export type { PaymentProvider, PaymentStatus } from '@commerce/payments'

/** Test double on the shared contract. `capture` mode captures at creation; `fail` throws. */
export class FakePaymentProvider implements PaymentProvider {
  readonly id: string
  readonly label = 'Test gateway'
  readonly calls: string[] = []
  private counter = 0
  private readonly captured = new Set<string>()

  constructor(
    private readonly opts: { mode: 'capture' | 'fail'; id?: string } = { mode: 'capture' },
  ) {
    this.id = opts.id ?? 'fake'
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    this.calls.push(`createPayment:${input.orderId}:${input.amountPaise}`)
    if (this.opts.mode === 'fail') throw new Error('fake gateway declined')
    this.counter += 1
    const providerRef = `fake_${this.counter}`
    this.captured.add(providerRef)
    return {
      providerRef,
      status: 'captured',
      session: { kind: 'none', provider: this.id, providerRef },
    }
  }

  async confirm(providerRef: string, _confirmation: ClientConfirmation) {
    this.calls.push(`confirm:${providerRef}`)
    return { status: 'captured' as const, providerPaymentId: providerRef }
  }

  async fetchStatus(providerRef: string) {
    return {
      status: (this.captured.has(providerRef) ? 'captured' : 'pending') as PaymentStatus,
      providerPaymentId: providerRef,
      amountPaise: 0,
    }
  }

  async refund(providerPaymentId: string, amountPaise: number) {
    this.calls.push(`refund:${providerPaymentId}:${amountPaise}`)
    return { providerRefundId: `rf_${providerPaymentId}`, status: 'processed' as const }
  }

  parseWebhook(): WebhookVerification {
    return { ok: false, reason: 'fake provider has no webhooks' }
  }
}
