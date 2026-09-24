import type {
  ClientConfirmation,
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProviderFactory,
  PaymentStatus,
} from '@commerce/payments'
import {
  qrWasPaid,
  type RazorpayConfig,
  RazorpayProvider,
  type RzpPayment,
  type RzpQrCode,
  razorpayFactory,
} from './razorpay'

/** How long a QR stays open. The store's unpaid-order window still decides when the order goes. */
export const QR_OPEN_MINUTES = 30

/** Razorpay caps the QR `name` and `description`. */
const QR_TEXT_MAX = 100

export const RAZORPAY_UPI_ID = 'razorpay_upi'

/**
 * Only what matching needs: our order, its number, and the attempt's key. The
 * QR's notes come back on `qr_code.*` webhooks, so a QR whose id failed to
 * record still finds its attempt.
 */
export function buildQrNotes(input: CreatePaymentInput): Record<string, string> {
  const notes: Record<string, string> = { orderId: input.orderId }
  if (input.orderNumber != null) notes.orderNumber = String(input.orderNumber)
  if (input.idempotencyKey) notes.idempotencyKey = input.idempotencyKey
  return notes
}

/** `close_by` in Unix seconds, `minutes` from `now`. */
export const qrCloseBy = (now: Date, minutes: number = QR_OPEN_MINUTES): number =>
  Math.floor(now.getTime() / 1000) + minutes * 60

/**
 * Razorpay does not document a UPI intent on the QR entity. Some accounts
 * return the encoded string anyway; use it only when it is a real `upi://` link.
 */
export function upiIntentOf(qr: Record<string, unknown>): string | undefined {
  for (const key of ['payload', 'upi_intent', 'intent_url', 'qr_string']) {
    const v = qr[key]
    if (typeof v === 'string' && v.startsWith('upi://')) return v
  }
  return undefined
}

function qrStatus(qr: RzpQrCode): PaymentStatus {
  if (qrWasPaid(qr)) return 'captured'
  return qr.status === 'closed' ? 'failed' : 'pending'
}

/**
 * "UPI (auto-confirmed)": a single-use Razorpay UPI QR for the exact amount,
 * shown on the thank-you page. No Checkout modal and no merchant step: the
 * `qr_code.credited` webhook captures the attempt, `qr_code.closed` unpaid
 * fails it and the shopper asks for a new QR (a new attempt). Runs on the
 * Razorpay keys, and shares Razorpay's webhook URL and parser.
 *
 * Razorpay QR Codes API (official): https://razorpay.com/docs/api/qr-codes/
 */
export class RazorpayUpiQrProvider extends RazorpayProvider {
  override readonly id = RAZORPAY_UPI_ID
  override readonly label = 'UPI (auto-confirmed)'
  readonly webhookId = 'razorpay'

  constructor(
    config: RazorpayConfig,
    private readonly now: () => Date = () => new Date(),
  ) {
    super(config)
  }

  override async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const label = input.orderNumber != null ? `Order ${input.orderNumber}` : input.orderId
    const closeBy = qrCloseBy(this.now())
    const qr = (await this.client.qrCode.create({
      type: 'upi_qr',
      name: (this.config.displayName ?? 'Checkout').slice(0, QR_TEXT_MAX),
      usage: 'single_use',
      fixed_amount: true,
      payment_amount: input.amountPaise,
      description: label.slice(0, QR_TEXT_MAX),
      close_by: closeBy,
      notes: buildQrNotes(input),
    })) as unknown as RzpQrCode & Record<string, unknown>
    return {
      providerRef: qr.id,
      status: 'pending',
      session: {
        kind: 'upi_qr',
        provider: this.id,
        providerRef: qr.id,
        qr: {
          imageUrl: qr.image_url,
          upiUri: upiIntentOf(qr),
          amountPaise: input.amountPaise,
          expiresAt: new Date((qr.close_by ?? closeBy) * 1000).toISOString(),
        },
      },
    }
  }

  /** Nothing is posted back from the browser; the answer is whatever the QR says. */
  override async confirm(providerRef: string, _confirmation: ClientConfirmation) {
    const { status, providerPaymentId } = await this.fetchStatus(providerRef)
    return { status, providerPaymentId }
  }

  override async fetchStatus(providerRef: string) {
    const qr = (await this.client.qrCode.fetch(providerRef)) as unknown as RzpQrCode
    const status = qrStatus(qr)
    let providerPaymentId: string | null = null
    if (status === 'captured') {
      const res = (await this.client.qrCode.fetchAllPayments(providerRef)) as unknown as {
        items: RzpPayment[]
      }
      providerPaymentId = res.items.find((p) => p.status === 'captured')?.id ?? null
    }
    return { status, providerPaymentId, amountPaise: Number(qr.payment_amount ?? 0) }
  }
}

/** Offered as its own method at checkout; the keys come from the Razorpay settings. */
export const razorpayUpiFactory: PaymentProviderFactory<RazorpayConfig> = {
  id: RAZORPAY_UPI_ID,
  label: 'UPI (auto-confirmed, Razorpay QR)',
  credentialsFrom: razorpayFactory.id,
  fields: [],
  validateConfig: (raw) => razorpayFactory.validateConfig(raw),
  create: (config) => new RazorpayUpiQrProvider(config),
}
