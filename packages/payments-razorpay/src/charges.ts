/**
 * What Razorpay kept from a payment and how the shopper paid, from its payment entity
 * (https://razorpay.com/docs/api/payments/fetch-with-id/, read 11 October 2026). Used on the
 * capture webhook and by `fetchCharges` (razorpay.ts); core records it (payments/charges.ts).
 */
import type { PaymentCharges, PaymentMethodDetail } from '@commerce/payments'
import type Razorpay from 'razorpay'

/** Razorpay's payment entity, the fields we read. */
export type RzpPayment = RzpPaymentCharges & {
  id: string
  order_id?: string | null
  amount: number
  status: string
  /** Set on a failed payment: `BAD_REQUEST_ERROR`, `GATEWAY_ERROR`… */
  error_code?: string | null
  error_description?: string | null
  /** Machine reason (`payment_risk_check_failed`, `payment_cancelled`…). */
  error_reason?: string | null
  /** `customer`, `bank`, `business`, `internal`… */
  error_source?: string | null
  error_step?: string | null
  notes?: Record<string, string> | null
}

/** The payment entity's fields fees depend on. */
export type RzpPaymentCharges = {
  /** card, netbanking, wallet, emi, upi, cardless_emi, paylater. */
  method?: string | null
  international?: boolean | null
  /** Fee Razorpay kept, GST included, paise; null until it is worked out. */
  fee?: number | null
  /** GST inside `fee`, paise. */
  tax?: number | null
  /** Present in webhooks for card payments, and on a fetch with `expand[]=card`. */
  card?: RzpCard | null
  bank?: string | null
  wallet?: string | null
}

/** Razorpay's card entity, the fields fee rates depend on. */
export type RzpCard = {
  /** credit, debit, prepaid, unknown. */
  type?: string | null
  /** American Express, Diners Club, Maestro, MasterCard, RuPay, Unknown, Visa. */
  network?: string | null
  international?: boolean | null
  /** customer, business. */
  sub_type?: string | null
}

const CARD_NETWORKS: Record<string, string> = {
  'american express': 'amex',
  'diners club': 'diners',
  mastercard: 'mastercard',
  maestro: 'maestro',
  rupay: 'rupay',
  visa: 'visa',
}

const METHOD_KINDS: Record<string, PaymentMethodDetail['kind']> = {
  upi: 'upi',
  card: 'card',
  netbanking: 'netbanking',
  wallet: 'wallet',
  emi: 'emi',
  cardless_emi: 'cardless_emi',
  paylater: 'paylater',
}

/** How a Razorpay payment was paid, from its `method` and card entity. */
function methodOf(p: RzpPaymentCharges): PaymentMethodDetail | null {
  if (!p.method) return null
  const kind = METHOD_KINDS[p.method] ?? 'other'
  const card = p.card ?? null
  const type = card?.type
  const network = card?.network ? CARD_NETWORKS[card.network.toLowerCase()] : undefined
  return {
    kind,
    cardType: type === 'credit' || type === 'debit' || type === 'prepaid' ? type : undefined,
    network,
    international: card?.international ?? p.international ?? undefined,
    corporate: card?.sub_type ? card.sub_type === 'business' : undefined,
    provider: p.bank ?? p.wallet ?? undefined,
  }
}

const paise = (v: number | null | undefined): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null

/**
 * The fee and method on a Razorpay payment entity. Razorpay documents `fee` as "Fee
 * (including GST) charged by Razorpay" and `tax` as "GST charged for the payment", both in
 * paise (https://razorpay.com/docs/api/payments/fetch-with-id/); they can be null on the
 * capture webhook (the card sample has both null), and the fee sync fetches them later.
 */
export function chargesOf(p: RzpPaymentCharges & { amount: number }): PaymentCharges {
  const feePaise = paise(p.fee)
  return {
    feePaise,
    feeTaxPaise: feePaise === null ? null : Math.min(paise(p.tax) ?? 0, feePaise),
    method: methodOf(p),
    grossPaise: paise(p.amount) ?? undefined,
  }
}

/**
 * Fetch one payment with its card entity (`expand[]=card`: the card's type, network and
 * sub-type pick the rate). Null for a payment that did not take money. Read-only.
 */
export async function fetchCharges(
  client: Razorpay,
  paymentId: string,
): Promise<PaymentCharges | null> {
  const p = (await client.payments.fetch(paymentId, {
    'expand[]': 'card',
  })) as unknown as RzpPayment
  return p.status === 'captured' || p.status === 'refunded' ? chargesOf(p) : null
}
