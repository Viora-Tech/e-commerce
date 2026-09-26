import type {
  CreatePaymentInput,
  CreatePaymentResult,
  ManualInstructions,
  PaymentProvider,
  PaymentProviderFactory,
  WebhookVerification,
} from '@commerce/payments'

export type ManualConfig = {
  upiId?: string | undefined
  payeeName?: string | undefined
  bankName?: string | undefined
  accountName?: string | undefined
  accountNumber?: string | undefined
  ifsc?: string | undefined
  note?: string | undefined
}

/** UPI deep link per NPCI's linking spec: amount fixed, order number as the note. */
export function upiDeepLink(input: {
  upiId: string
  payeeName: string
  amountPaise: number
  note: string
}): string {
  const q = new URLSearchParams({
    pa: input.upiId,
    pn: input.payeeName,
    am: (input.amountPaise / 100).toFixed(2),
    cu: 'INR',
    tn: input.note,
  })
  return `upi://pay?${q.toString()}`
}

/**
 * UPI or bank transfer to the merchant's own account. Zero fees, no API.
 * The shopper pays with the order number as reference; the merchant marks
 * the order paid from admin when the money shows up. Decentro or a bank API
 * can automate that confirmation later without changing this contract.
 */
export class ManualPaymentProvider implements PaymentProvider {
  readonly id = 'manual'
  /** What shoppers see at checkout; the admin calls it "UPI to your own ID — you confirm it". */
  readonly label = 'UPI or bank transfer to the shop'

  constructor(private readonly config: ManualConfig) {}

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const providerRef = `manual_${input.orderId}`
    const reference = input.orderNumber != null ? `Order ${input.orderNumber}` : input.orderId
    const c = this.config
    const instructions: ManualInstructions = {
      reference,
      upi:
        c.upiId && c.payeeName
          ? {
              id: c.upiId,
              payeeName: c.payeeName,
              deepLink: upiDeepLink({
                upiId: c.upiId,
                payeeName: c.payeeName,
                amountPaise: input.amountPaise,
                note: reference,
              }),
            }
          : undefined,
      bank:
        c.bankName && c.accountName && c.accountNumber && c.ifsc
          ? {
              bankName: c.bankName,
              accountName: c.accountName,
              accountNumber: c.accountNumber,
              ifsc: c.ifsc,
            }
          : undefined,
      note: c.note,
    }
    return {
      providerRef,
      status: 'pending',
      session: { kind: 'manual', provider: this.id, providerRef, instructions },
    }
  }

  async confirm(providerRef: string) {
    return { status: 'pending' as const, providerPaymentId: providerRef }
  }

  async fetchStatus(providerRef: string) {
    return { status: 'pending' as const, providerPaymentId: providerRef, amountPaise: 0 }
  }

  async refund(providerPaymentId: string) {
    return { providerRefundId: `rf_${providerPaymentId}`, status: 'pending' as const }
  }

  parseWebhook(): WebhookVerification {
    return { ok: false, reason: 'manual payments have no webhooks' }
  }
}

/** Trim every field, drop blanks, upper-case the IFSC so validation matches what banks print. */
function normaliseManualConfig(raw: ManualConfig): ManualConfig {
  const out: ManualConfig = {}
  for (const [k, v] of Object.entries(raw) as [keyof ManualConfig, string | undefined][]) {
    const t = v?.trim()
    if (t) out[k] = k === 'ifsc' ? t.toUpperCase() : t
  }
  return out
}

export const manualFactory: PaymentProviderFactory<ManualConfig> = {
  id: 'manual',
  label: 'UPI to your own ID — you confirm it',
  fields: [
    { key: 'upiId', label: 'UPI ID', help: 'e.g. waimers@hdfcbank' },
    { key: 'payeeName', label: 'Payee name', help: 'Shown in the UPI app.' },
    { key: 'bankName', label: 'Bank' },
    { key: 'accountName', label: 'Account holder' },
    { key: 'accountNumber', label: 'Account number' },
    { key: 'ifsc', label: 'IFSC' },
    { key: 'note', label: 'Instructions for the shopper', multiline: true },
  ],
  validateConfig(raw) {
    const r = normaliseManualConfig((raw ?? {}) as ManualConfig)
    const hasUpi = Boolean(r.upiId && r.payeeName)
    const hasBank = Boolean(r.bankName && r.accountName && r.accountNumber && r.ifsc)
    if (!hasUpi && !hasBank) {
      return { ok: false, errors: ['enter a UPI ID with payee name, or full bank details'] }
    }
    if (r.upiId && !/^[\w.-]+@[\w.-]+$/.test(r.upiId)) {
      return { ok: false, errors: ['UPI ID should look like name@bank'] }
    }
    if (r.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(r.ifsc)) {
      return { ok: false, errors: ['IFSC should be 11 characters like HDFC0001234'] }
    }
    return { ok: true, config: r }
  },
  create: (config) => new ManualPaymentProvider(config),
}
