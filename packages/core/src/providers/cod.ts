import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  PaymentProviderFactory,
  WebhookVerification,
} from '@commerce/payments'

/**
 * Cash on delivery. Nothing is charged at checkout, so the order stays
 * `placed` with a `pending` payment until the courier remits.
 */
export class CodPaymentProvider implements PaymentProvider {
  readonly id = 'cod'
  readonly label = 'Cash on delivery'

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const providerRef = `cod_${input.orderId}`
    return {
      providerRef,
      status: 'pending',
      session: { kind: 'none', provider: this.id, providerRef },
    }
  }

  async confirm(providerRef: string) {
    return { status: 'pending' as const, providerPaymentId: providerRef }
  }

  async fetchStatus(providerRef: string) {
    return { status: 'pending' as const, providerPaymentId: providerRef, amountPaise: 0 }
  }

  async refund(providerPaymentId: string) {
    return { providerRefundId: `rf_${providerPaymentId}`, status: 'processed' as const }
  }

  parseWebhook(): WebhookVerification {
    return { ok: false, reason: 'cod has no webhooks' }
  }
}

export const codFactory: PaymentProviderFactory<Record<string, never>> = {
  id: 'cod',
  label: 'Cash on delivery',
  fields: [],
  validateConfig: () => ({ ok: true, config: {} }),
  create: () => new CodPaymentProvider(),
}
