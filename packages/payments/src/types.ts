/**
 * The payment contract. Adapters implement it; the platform, the storefront and
 * the worker only ever talk to these shapes. Money is integer paise.
 */

export type PaymentStatus = 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded'

/**
 * The ways a shopper can pay online, as the merchant turns them on in
 * Settings → Payments. Gateways map each kind to their own method codes.
 * `emi` covers card EMI, cardless EMI and pay later.
 */
export type PaymentMethodKind = 'upi' | 'card' | 'netbanking' | 'wallet' | 'emi'

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
  /** Set instead of `orderNumber` while the checkout is a draft (#D57) waiting for payment. */
  draftNumber?: number | undefined
  amountPaise: number
  currency: 'INR'
  customer: PaymentCustomer
  /** The store's name, shown on the gateway's page unless the gateway has its own name set. */
  merchantName?: string | undefined
  /** Where the gateway should send the shopper afterwards, for redirect flows. */
  returnUrl?: string | undefined
  /** Delivery address; EMI/BNPL providers use it for risk checks. */
  shipping?: PaymentShipping | undefined
  /** Basket summary; gateways forward it to lenders and show it on their pages. */
  lines?: PaymentLine[] | undefined
  /**
   * One key per payment attempt (`<orderId>:<attempt>`). Adapters pass it to the
   * gateway's idempotency header where one exists, and otherwise store it on the
   * gateway object (receipt, notes) so webhooks can find the attempt by it.
   * Pattern from Medusa's payment provider `idempotency_key` (MIT).
   */
  idempotencyKey?: string | undefined
  /**
   * The online methods the merchant turned on, in the order shoppers should
   * see them. Adapters show only these, in this order, where the gateway
   * allows it. Undefined means "whatever the gateway account offers".
   */
  methods?: PaymentMethodKind[] | undefined
  /**
   * `manual`: authorise only; the merchant captures later (`PaymentProvider.capture`). Adapters
   * without `capture` ignore it. Undefined means capture at once, as before.
   */
  capture?: 'manual' | undefined
}

export type PaymentShipping = {
  name: string
  line1: string
  line2?: string | undefined
  city: string
  state: string
  postalCode: string
  /** ISO 3166-1 alpha-2. */
  country: string
}

export type PaymentLine = {
  title: string
  quantity: number
  unitPricePaise: number
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
  | {
      /** Shopper pays on their own (UPI, bank transfer); the merchant confirms later. */
      kind: 'manual'
      provider: string
      providerRef: string
      instructions: ManualInstructions
    }
  | {
      /**
       * A single-use UPI QR for the exact amount, confirmed by the gateway's
       * webhook (no merchant step). Shown on the thank-you page until it closes.
       */
      kind: 'upi_qr'
      provider: string
      providerRef: string
      qr: UpiQr
    }
  | { kind: 'none'; provider: string; providerRef: string }

/** A UPI app's own payment link, e.g. `tez://upi/pay?...` for Google Pay. */
export type UpiApp = { id: 'gpay' | 'phonepe' | 'paytm' | 'cred'; uri: string }

export type UpiQr = {
  /** Hosted QR image from the gateway; without one the storefront draws the QR from `upiUri`. */
  imageUrl?: string | undefined
  /** `upi://pay?...` intent to open a UPI app on the same phone, when the gateway returns one. */
  upiUri?: string | undefined
  /** App-specific links (Google Pay, PhonePe…) for phones, when the gateway returns them. */
  apps?: UpiApp[] | undefined
  amountPaise: number
  /** ISO time the QR closes; after it the shopper asks for a new one (a new attempt). */
  expiresAt: string
}

export type ManualInstructions = {
  /** Text the shopper must quote so the merchant can match the payment. */
  reference: string
  upi?: { id: string; payeeName: string; deepLink: string } | undefined
  bank?: { bankName: string; accountName: string; accountNumber: string; ifsc: string } | undefined
  note?: string | undefined
}

export type CreatePaymentResult = {
  providerRef: string
  status: PaymentStatus
  session: CheckoutSession
}

/**
 * How the shopper paid, as precisely as the gateway says. Picks the store's fee rate for a
 * payment whose fee the gateway has not reported yet (core order/profit.ts).
 */
export type PaymentMethodDetail = {
  kind: 'upi' | 'card' | 'netbanking' | 'wallet' | 'emi' | 'cardless_emi' | 'paylater' | 'other'
  /** Cards and card EMI. */
  cardType?: 'credit' | 'debit' | 'prepaid' | undefined
  /** Card network, lowercase: visa, mastercard, rupay, amex, diners, maestro… */
  network?: string | undefined
  /** Card issued outside India. */
  international?: boolean | undefined
  /** Business or corporate card. */
  corporate?: boolean | undefined
  /** Netbanking bank code, wallet or lender, when the gateway names it. */
  provider?: string | undefined
}

/**
 * What the gateway kept from one payment, as it reported it. Money is integer paise.
 * `feePaise` is the whole deduction, GST included; `feeTaxPaise` is the GST inside it (input
 * tax credit for a GST-registered merchant). A fee the shopper paid on top is not the
 * merchant's cost: adapters leave out a fee the gateway says the shopper bore, and core takes
 * off anything paid above the attempt's amount (`grossPaise`).
 */
export type PaymentCharges = {
  /** Null when the gateway has not worked the fee out yet. */
  feePaise: number | null
  feeTaxPaise: number | null
  method: PaymentMethodDetail | null
  /** What the shopper paid, as the gateway reports it, when known. */
  grossPaise?: number | undefined
}

/** What the browser posts back after a client-side checkout completes. */
export type ClientConfirmation = Record<string, string>

export type WebhookEvent =
  | {
      type: 'payment.captured'
      providerRef: string
      /** The attempt's idempotency key, when the gateway echoes it back (notes). */
      idempotencyKey?: string | null | undefined
      providerPaymentId: string
      amountPaise: number
      orderId: string | null
      /** The fee and method, when the event carries them. */
      charges?: PaymentCharges | undefined
      raw: unknown
    }
  | {
      type: 'payment.authorized'
      providerRef: string
      /** The attempt's idempotency key, when the gateway echoes it back (notes). */
      idempotencyKey?: string | null | undefined
      providerPaymentId: string
      amountPaise: number
      orderId: string | null
      raw: unknown
    }
  | {
      type: 'payment.failed'
      providerRef: string
      /** The attempt's idempotency key, when the gateway echoes it back (notes). */
      idempotencyKey?: string | null | undefined
      providerPaymentId: string | null
      reason: string
      orderId: string | null
      raw: unknown
    }
  | {
      /** The gateway worked out its fee after the capture (Cashfree's charges webhook). */
      type: 'payment.charges'
      providerRef: string
      providerPaymentId: string
      charges: PaymentCharges
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
  | {
      /** The gateway gave up on a refund it had accepted: the money did not go back. */
      type: 'refund.failed'
      providerRef: string
      providerRefundId: string
      reason: string
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
  /**
   * The id webhooks arrive under (`/webhooks/payments/<webhookId>/...`) when
   * it differs from `id`: a second method on the same gateway account shares
   * the gateway's one webhook URL and its event dedupe.
   */
  readonly webhookId?: string | undefined
  /**
   * Whether these credentials take real money ('live') or are the gateway's
   * sandbox ('test'). Orders paid through a 'test' provider are flagged as test
   * orders. Unset means unknown, which is treated as live.
   */
  readonly mode?: 'test' | 'live' | undefined

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
    /** Extra references some gateways refund by (Cashfree refunds per order, not per payment). */
    context?: RefundContext,
  ): Promise<{ providerRefundId: string; status: 'pending' | 'processed' }>

  /**
   * Optional capability: capture a payment that was only authorised (created with
   * `capture: 'manual'`). Resolves once the gateway accepts the capture.
   */
  capture?(
    providerPaymentId: string,
    amountPaise: number,
  ): Promise<{ status: PaymentStatus; providerPaymentId: string }>

  /**
   * Optional read-only check that the saved keys work, for the Connect page's
   * "Test connection" button. Must not create anything on the gateway.
   */
  testConnection?(): Promise<ConnectionTestResult>

  /**
   * Optional read-only lookup of what the gateway kept from one captured payment, and how it
   * was paid. Null when the gateway has no answer yet. Used by the fee sync (worker) for
   * payments whose fee did not come with the capture. Must not create anything.
   */
  fetchCharges?(input: {
    providerRef: string
    providerPaymentId: string
  }): Promise<PaymentCharges | null>

  /**
   * Optional read-only lookup of a refund's state, for gateways whose refund updates do not
   * arrive by webhook (Decentro). The worker's refund sync asks about refunds still `pending`.
   * Must not create anything.
   */
  fetchRefundStatus?(input: {
    providerRefundId: string
    providerRef: string
  }): Promise<'pending' | 'processed' | 'failed'>

  /** Verify the signature and parse the body into a normalised event. Never throws on bad input. */
  parseWebhook(input: {
    rawBody: string
    headers: Record<string, string | undefined>
  }): WebhookVerification

  /**
   * Fields the gateway needs in the body of our 200 reply to a webhook, or it
   * keeps retrying (Decentro wants `{ "response_code": "CB_S00000" }`).
   */
  readonly webhookAck?: Record<string, string> | undefined

  /**
   * Optional capability: refund by sending the money as a fresh payout (UPI)
   * instead of reversing the original payment. For gateways that can pay out
   * from a funded account; the refund flow may use it when a UPI refund to
   * source is not possible. Needs the shopper's UPI ID.
   */
  refundViaPayout?(input: PayoutRefundInput): Promise<PayoutRefundResult>
}

export type PayoutRefundInput = {
  /** Shopper's UPI ID (VPA), e.g. from the payment's webhook. */
  toUpi: string
  /** Name on the shopper's account; gateways may reject special characters. */
  payeeName: string
  amountPaise: number
  /** Our refund row key; the same key never pays out twice. */
  refundKey: string
  note?: string | undefined
}

export type PayoutRefundResult = {
  providerRefundId: string
  status: 'pending' | 'processed'
}

export type RefundContext = {
  /** The attempt's gateway reference (the gateway order id). */
  providerRef?: string | undefined
  /** Our refund row key, when the gateway wants a merchant refund id. */
  refundKey?: string | undefined
}

export type ConnectionTestResult = { ok: boolean; message: string }

export type ProviderField = {
  key: string
  label: string
  /** Encrypted at rest and masked in the UI. */
  secret?: boolean
  required?: boolean
  /** Asked for in the install's Connect step though not required: a key a gateway's OAuth
   *  connection does without (Razorpay's key secret). */
  connect?: boolean
  /** A value the merchant makes up and sets in the provider's dashboard too (a webhook
   *  secret): forms offer to generate one. */
  generate?: boolean
  multiline?: boolean
  /** `boolean` renders a checkbox and stores 'true' | 'false'. Defaults to text. */
  type?: 'text' | 'boolean'
  help?: string
  /** Written by the platform (e.g. OAuth tokens), never typed in: forms leave it out. */
  hidden?: boolean
}

export type PaymentProviderFactory<Config> = {
  id: string
  label: string
  /** What the merchant fills in Settings > Payments. Drives the form; nothing is hard-coded in the admin. */
  fields: ProviderField[]
  /**
   * Borrow another factory's saved config (its keys), e.g. a second Razorpay
   * method. That config sits under this factory's own; enabling this one
   * needs the other configured, not enabled.
   */
  credentialsFrom?: string | undefined
  /**
   * Renew short-lived credentials (OAuth access tokens) before they run out.
   * Gets the decrypted saved config; returns the fields to overwrite, or null
   * when nothing needed doing. The platform saves (encrypted) and uses them.
   */
  refreshCredentials?:
    | ((saved: Record<string, string>, now?: Date) => Promise<Record<string, string> | null>)
    | undefined
  /** Online methods this gateway can take, for the admin's "Shoppers can pay with" row. */
  methods?: readonly PaymentMethodKind[] | undefined
  /** Zod-like validator kept minimal so this package has no runtime deps. */
  validateConfig(raw: unknown): { ok: true; config: Config } | { ok: false; errors: string[] }
  create(config: Config): PaymentProvider
}
