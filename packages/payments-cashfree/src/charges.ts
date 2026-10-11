/**
 * What Cashfree kept from a payment and how the shopper paid. Official docs used (read
 * 11 October 2026):
 * - https://www.cashfree.com/docs/api-reference/payments/latest/payments/get-payment-by-id
 *   (`payment_group`, `payment_method`)
 * - https://www.cashfree.com/docs/api-reference/payments/latest/settlements/get-settlements-for-order
 *   (`pg_service_charge`, `pg_service_tax`, `charged_to`)
 * - https://www.cashfree.com/docs/api-reference/payments/latest/payments/webhooks
 *   (PAYMENT_CHARGES_WEBHOOK `charges_details`)
 * Used by the webhooks and `fetchCharges` (cashfree.ts); core records it (payments/charges.ts).
 */
import type { PaymentCharges, PaymentMethodDetail } from '@commerce/payments'

/** One key per instrument (`card`, `upi`, `netbanking`, `app`, `emi`…); the fields we read. */
export type CfPaymentMethod = Record<
  string,
  | {
      channel?: string | null
      card_network?: string | null
      card_type?: string | null
      card_sub_type?: string | null
      card_country?: string | null
      provider?: string | null
      netbanking_bank_name?: string | null
    }
  | null
  | undefined
>

/** The charges webhook's breakdown, in rupees (Cashfree "Success Payment TDR"). */
export type CfChargesDetails = {
  service_charge?: number | null
  service_tax?: number | null
  settlement_amount?: number | null
}

/** GET /orders/{order_id}/settlements: the payment's charges, in rupees. */
export type CfOrderSettlement = {
  payment_details?: {
    cf_payment_id?: string | number
    payment_amount?: number | null
    pg_service_charge?: number | null
    pg_service_tax?: number | null
    forex_conversion_handling_charge?: number | null
    forex_conversion_handling_tax?: number | null
    /** MERCHANT, CUSTOMER, MERCHANT_AND_CUSTOMER, VENDOR. */
    charged_to?: string | null
  } | null
}

/** Cashfree `payment_group` values to our method kinds. */
const CF_GROUPS: Record<string, Pick<PaymentMethodDetail, 'kind' | 'cardType'>> = {
  credit_card: { kind: 'card', cardType: 'credit' },
  debit_card: { kind: 'card', cardType: 'debit' },
  prepaid_card: { kind: 'card', cardType: 'prepaid' },
  credit_card_emi: { kind: 'emi', cardType: 'credit' },
  debit_card_emi: { kind: 'emi', cardType: 'debit' },
  upi: { kind: 'upi' },
  upi_credit_card: { kind: 'upi' },
  upi_ppi: { kind: 'upi' },
  upi_ppi_offline: { kind: 'upi' },
  net_banking: { kind: 'netbanking' },
  wallet: { kind: 'wallet' },
  cardless_emi: { kind: 'cardless_emi' },
  pay_later: { kind: 'paylater' },
}

const CF_NETWORKS: Record<string, string> = {
  visa: 'visa',
  mastercard: 'mastercard',
  rupay: 'rupay',
  amex: 'amex',
  'american express': 'amex',
  diners: 'diners',
  'diners club': 'diners',
  maestro: 'maestro',
}

/** How a Cashfree payment was paid, from its `payment_group` and `payment_method`. */
function cashfreeMethodOf(
  group: string | null | undefined,
  method: CfPaymentMethod | null | undefined,
): PaymentMethodDetail | null {
  if (!group) return null
  const base = CF_GROUPS[group] ?? { kind: 'other' as const }
  const card = method?.card ?? method?.emi ?? null
  const network = card?.card_network ? CF_NETWORKS[card.card_network.toLowerCase()] : undefined
  const country = card?.card_country?.toUpperCase()
  const instrument = method?.app ?? method?.cardless_emi ?? method?.paylater ?? null
  return {
    ...base,
    network,
    // Card sub-type: R retail, P premium, C corporate.
    corporate: card?.card_sub_type ? card.card_sub_type.toUpperCase() === 'C' : undefined,
    international: country ? country !== 'IN' : undefined,
    provider: instrument?.provider ?? method?.netbanking?.netbanking_bank_name ?? undefined,
  }
}

const rupeesToPaise = (v: number | null | undefined): number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v * 100) : 0

/**
 * The charges webhook's fee: Cashfree's sample has `service_charge` 0.12 + `service_tax` 0.02
 * leaving `settlement_amount` 5.86 of a ₹6 payment, so the fee is the two added together.
 * UNVERIFIED: whether a non-null `service_charge_discount` is already taken off
 * `service_charge`; we take `service_charge` as charged.
 */
export function chargesFromDetails(d: CfChargesDetails | null | undefined): {
  feePaise: number | null
  feeTaxPaise: number | null
} {
  if (!d || (d.service_charge == null && d.service_tax == null)) {
    return { feePaise: null, feeTaxPaise: null }
  }
  const tax = rupeesToPaise(d.service_tax)
  return { feePaise: rupeesToPaise(d.service_charge) + tax, feeTaxPaise: tax }
}

/**
 * The settlement's fee for one payment: the gateway charge and forex handling, each with its
 * GST. A charge the shopper bore (`charged_to` CUSTOMER) is not the merchant's.
 */
function chargesFromSettlement(s: CfOrderSettlement | null | undefined): {
  feePaise: number | null
  feeTaxPaise: number | null
} {
  const d = s?.payment_details
  if (!d || (d.pg_service_charge == null && d.pg_service_tax == null)) {
    return { feePaise: null, feeTaxPaise: null }
  }
  if (d.charged_to?.toUpperCase() === 'CUSTOMER') return { feePaise: 0, feeTaxPaise: 0 }
  const tax = rupeesToPaise(d.pg_service_tax) + rupeesToPaise(d.forex_conversion_handling_tax)
  const charge =
    rupeesToPaise(d.pg_service_charge) + rupeesToPaise(d.forex_conversion_handling_charge)
  return { feePaise: charge + tax, feeTaxPaise: tax }
}

/** A Cashfree payment, the fields fees depend on. */
export type CfPaidPayment = {
  payment_status: string
  payment_amount: number
  payment_group?: string
  payment_method?: CfPaymentMethod | null
}

/** The method alone, for a capture: Cashfree works the fee out later. */
export function methodOnly(pay: Omit<CfPaidPayment, 'payment_status'>): PaymentCharges {
  return {
    feePaise: null,
    feeTaxPaise: null,
    method: cashfreeMethodOf(pay.payment_group, pay.payment_method),
  }
}

/**
 * A paid payment's charges: the method from the payment, the fee from the order's settlement
 * when that settlement is for this payment (none yet leaves the fee unknown).
 */
export function chargesOfPayment(
  pay: CfPaidPayment,
  settlement: CfOrderSettlement | null,
  paymentId: string,
): PaymentCharges {
  const settledId = settlement?.payment_details?.cf_payment_id
  const samePayment = settledId == null || String(settledId) === paymentId
  return {
    ...chargesFromSettlement(samePayment ? settlement : null),
    method: cashfreeMethodOf(pay.payment_group, pay.payment_method),
    grossPaise: rupeesToPaise(pay.payment_amount) || undefined,
  }
}
