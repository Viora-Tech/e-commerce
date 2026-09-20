/**
 * The payment contract. Adapters implement it; the platform, the storefront and
 * the worker only ever talk to these shapes. Money is integer paise.
 */

export type PaymentStatus = 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded'

export type PaymentCustomer = {
  email?: string | undefined
  phone?: string | undefined
  name?: string | undefined
}

export type CreatePaymentInput = {
  /** Our order id, echoed back in webhooks so events can be matched. */
  orderId: string
  /** Human order number, shown on the gateway's page where supported. */
  orderNumber?: number | undefined
  amountPaise: number
  currency: 'INR'
  customer: PaymentCustomer
  /** Where the gateway should send the shopper afterwards, for redirect flows. */
  returnUrl?: string | undefined
}

/**
 * What the storefront needs to hand off to the gateway. Adapters pick one kind:
 * - `client`: open the gateway's JS checkout in the page (Razorpay, Cashfree).
 * - `redirect`: send the shopper to a hosted page (PhonePe, PayU).
 * - `none`: nothing to do (COD, or a fully server-side capture).
 */
export type CheckoutSession =
  | {
      kind: 'client'
      provider: string
      providerRef: string
      publicKey: string
      options: Record<string, unknown>
    }
  | { kind: 'redirect'; provider: string; providerRef: string; url: string }
  | { kind: 'none'; provider: string; providerRef: string }

export type CreatePaymentResult = {
  providerRef: string
  status: PaymentStatus
  session: CheckoutSession
}

/** What the browser posts back after a client-side checkout completes. */
export type ClientConfirmation = Record<string, string>

export type WebhookEvent =
  | {
      type: 'payment.captured'
      providerRef: string
      providerPaymentId: string
      amountPaise: number
      orderId: string | null
      raw: unknown
    }
  | {
      type: 'payment.authorized'
      providerRef: string
      providerPaymentId: string
      amountPaise: number
      orderId: string | null
      raw: unknown
    }
  | {
      type: 'payment.failed'
      providerRef: string
      providerPaymentId: string | null
      reason: string
      orderId: string | null
      raw: unknown
    }
  | {
      type: 'refund.processed'
      providerRef: string
      providerRefundId: string
      amountPaise: number
      orderId: string | null
      raw: unknown
    }
  | { type: 'ignored'; eventName: string; raw: unknown }

export type WebhookVerification =
  | { ok: true; eventId: string; event: WebhookEvent }
  | { ok: false; reason: string }

export interface PaymentProvider {
  /** Stable id, used in `order.payment_method` and settings. Lowercase, no spaces. */
  readonly id: string
  /** Shown to shoppers at checkout. */
  readonly label: string

  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>

  /**
   * Verify a client-side confirmation (e.g. Razorpay's handler payload) and
   * return the resulting status. Adapters with `redirect` or `none` sessions
   * may treat this as a no-op returning the current status.
   */
  confirm(
    providerRef: string,
    confirmation: ClientConfirmation,
  ): Promise<{ status: PaymentStatus; providerPaymentId: string | null }>

  /** Ask the gateway for the truth. Used to reconcile when a webhook is late or lost. */
  fetchStatus(
    providerRef: string,
  ): Promise<{ status: PaymentStatus; providerPaymentId: string | null; amountPaise: number }>

  refund(
    providerPaymentId: string,
    amountPaise: number,
    note?: string,
  ): Promise<{ providerRefundId: string; status: 'pending' | 'processed' }>

  /** Verify the signature and parse the body into a normalised event. Never throws on bad input. */
  parseWebhook(input: {
    rawBody: string
    headers: Record<string, string | undefined>
  }): WebhookVerification
}

export type PaymentProviderFactory<Config> = {
  id: string
  label: string
  /** Zod-like validator kept minimal so this package has no runtime deps. */
  validateConfig(raw: unknown): { ok: true; config: Config } | { ok: false; errors: string[] }
  create(config: Config): PaymentProvider
}
