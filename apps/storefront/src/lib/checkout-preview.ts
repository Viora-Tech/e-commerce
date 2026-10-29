import type { CartView } from '@commerce/core'
import { applyPaymentAdjustment, type PaymentAdjustmentValue } from '@commerce/core/adjustment-math'
import {
  type CheckoutSettings,
  checkoutRuleSubtotalPaise,
  codDecision,
  minimumOrderShortfall,
} from '@commerce/core/checkout-settings'
import { formatMoney } from '@commerce/money'
import { checkoutContent as content } from '@/data/checkout'
import type { AppliedGiftCard } from '@/lib/gift-card-actions'
import type { CheckoutMethod } from '@/lib/payments'
import type { CheckoutRate, CheckoutShipping } from '@/lib/shipping'

/*
 * The checkout form's previews, pure so they are tested on their own: what the summary
 * shows, which ways to pay are on offer and in what order. `placeOrder` recomputes every
 * amount on the server; nothing here is trusted.
 */

/** What the shipping row says: a price, "Free", or a prompt before the address is checked. */
export type ShippingRow =
  | { kind: 'price'; paise: number; name: string | null }
  | { kind: 'pending' }

/** How much each applied card covers, in order, and what is left to pay. Preview only. */
export function spendCards(cards: AppliedGiftCard[], totalPaise: number) {
  let left = totalPaise
  const rows = cards.map((c) => {
    const amountPaise = Math.min(c.balancePaise, left)
    left -= amountPaise
    return { ...c, amountPaise }
  })
  return { rows, duePaise: left }
}

/** Whether the applied cards cover the order before any payment fee; enough to decide COD, preview only. */
export const coveredByCardsBefore = (cards: AppliedGiftCard[], goodsPaise: number): boolean =>
  cards.reduce((sum, c) => sum + c.balancePaise, 0) >= goodsPaise

/** A basket of only gift cards: emailed, so no delivery check, and paid online. */
export const isDigitalOnly = (cart: CartView): boolean =>
  cart.lines.length > 0 && cart.lines.every((l) => l.giftCard)

/** Whether a way to pay takes UPI: Decentro's QR, or a gateway with UPI on. */
export function takesUpi(m: CheckoutMethod): boolean {
  if (m.id === 'decentro') return true
  if (m.id === 'razorpay' || m.id === 'cashfree') return !m.methods || m.methods.includes('upi')
  return false
}

/** UPI first, then the gateways' other methods, then transfers, cash on delivery last. */
function methodRank(m: CheckoutMethod): number {
  if (m.id === 'cod') return 4
  if (m.id === 'decentro') return 0
  if (takesUpi(m)) return 1
  if (m.id === 'razorpay' || m.id === 'cashfree') return 2
  return 3
}

/**
 * The ways to pay on offer for this basket, UPI first and cash on delivery last (the
 * merchant's order breaks ties). COD never pays for gift cards.
 */
export function offeredMethods(cart: CartView, methods: CheckoutMethod[]): CheckoutMethod[] {
  const offered = isDigitalOnly(cart) ? methods.filter((m) => m.id !== 'cod') : methods
  return offered
    .map((m, i) => ({ m, i }))
    .sort((a, b) => methodRank(a.m) - methodRank(b.m) || a.i - b.i)
    .map(({ m }) => m)
}

export type MethodView = {
  title: string
  hint: string | null
  icon: 'phone' | 'card' | 'cash' | 'bank'
  /** The gateway's brand when the option is a gateway ("Razorpay"), else null. */
  brand: string | null
}

/** The payment gateways' brand names, by provider id. */
const gatewayBrand = (m: CheckoutMethod): string | null => content.gatewayBrands[m.id] ?? null

/**
 * What a shopper reads for each way to pay. A gateway is titled by its brand ("Razorpay",
 * "Cashfree"), since a store may offer several, with what it takes as the hint
 * ("UPI · Cards · Netbanking"); UPI, cash on delivery and transfers say what they are.
 */
export function methodView(m: CheckoutMethod): MethodView {
  const names = m.methods?.map((id) => content.onlineMethodNames[id]).filter(Boolean) ?? []
  if (m.id === 'cod')
    return { title: content.methods.cod, hint: content.methods.codHint, icon: 'cash', brand: null }
  if (m.id === 'decentro')
    return {
      title: content.methods.upi,
      hint: content.methods.upiHint,
      icon: 'phone',
      brand: content.upiBrand,
    }
  if (m.id === 'manual') {
    return {
      title: content.methods.manual,
      hint: content.methods.manualHint,
      icon: 'bank',
      brand: null,
    }
  }
  const brand = gatewayBrand(m)
  if (brand) {
    const takes = takesUpi(m) ? content.methods.gatewayWithUpi : content.methods.gatewayNoUpi
    return {
      title: brand,
      hint: names.length ? names.join(' · ') : takes,
      icon: takesUpi(m) ? 'phone' : 'card',
      brand,
    }
  }
  return { title: m.label, hint: null, icon: 'card', brand: null }
}

/** The gateways that process the money on this checkout, once each: ["Razorpay", "Cashfree"]. */
export function processorNames(methods: CheckoutMethod[]): string[] {
  return [...new Set(methods.flatMap((m) => gatewayBrand(m) ?? []))]
}

export type CheckoutTotalsInput = {
  cart: CartView
  methods: CheckoutMethod[]
  settings: CheckoutSettings
  discountPaise: number
  shipping: CheckoutShipping | null
  rate: CheckoutRate | undefined
  giftCards: AppliedGiftCard[]
  /** The shopper's pick; a blocked cash on delivery falls back to the first online method. */
  picked: string
  pincode: string
  /** A deposit pre-order's balance, charged later. */
  laterPaise: number
}

/**
 * Every amount the form shows, and whether cash on delivery is allowed, in one pass. The
 * same order as `placeOrder` (discount, payment fee, shipping, gift cards), preview only.
 */
export function checkoutTotals(input: CheckoutTotalsInput) {
  const { cart, methods, settings, discountPaise, shipping, rate, giftCards } = input
  const digitalOnly = isDigitalOnly(cart)
  const offered = offeredMethods(cart, methods)
  const discounted = Math.max(0, cart.subtotalPaise - discountPaise)
  const shippingPaise = digitalOnly ? 0 : (rate?.pricePaise ?? 0)
  const delivery = shipping?.delivery
  // Settings → Checkout's COD limit and minimum judge only the lines that are not gift cards.
  const ruleSubtotal = checkoutRuleSubtotalPaise(cart.lines, discountPaise)
  const codRule = codDecision(settings.cod, {
    pincode: input.pincode,
    orderValuePaise: ruleSubtotal + shippingPaise,
  })
  // Delivery options app: Express (any prepaid-only option) refuses cash on delivery.
  const optionPrepaid = rate?.delivery?.codAllowed === false
  const codBlocked =
    optionPrepaid ||
    (delivery?.ok === true && delivery.serviceable && !delivery.codAvailable) ||
    (giftCards.length > 0 && !coveredByCardsBefore(giftCards, discounted + shippingPaise)) ||
    !codRule.allowed
  const payment =
    input.picked === 'cod' && codBlocked
      ? (offered.find((m) => m.id !== 'cod')?.id ?? input.picked)
      : input.picked
  const adjustment = previewAdjustment(
    methods.find((m) => m.id === payment),
    rate,
  )
  const { adjustmentPaise, totalPaise: goodsPaise } = applyPaymentAdjustment(discounted, adjustment)
  // Standard's COD route can cost more than its prepaid one: paying on delivery charges that.
  const codShippingPaise = rate?.delivery?.codPricePaise ?? null
  const chargedShippingPaise =
    payment === 'cod' && codShippingPaise !== null && !digitalOnly
      ? codShippingPaise
      : shippingPaise
  const totalPaise = goodsPaise + chargedShippingPaise
  const { rows: cardRows, duePaise } = spendCards(giftCards, totalPaise)
  const coveredByCards = giftCards.length > 0 && duePaise === 0
  const codExtraPaise = codShippingPaise === null ? 0 : codShippingPaise - shippingPaise
  const codNote =
    giftCards.length > 0 && !coveredByCards
      ? content.codWithGiftCard
      : optionPrepaid
        ? content.delivery.codPrepaidOnly(rate?.delivery?.optionName ?? '')
        : codRule.allowed
          ? codExtraPaise > 0 && rate?.delivery?.codCarrier
            ? content.delivery.codRoute(formatMoney(codExtraPaise), rate.delivery.codCarrier)
            : null
          : codRule.reason === 'blocked_pincode'
            ? content.codRules.blockedPincode
            : content.codRules.overLimit(formatMoney(codRule.limitPaise ?? 0))
  return {
    digitalOnly,
    offered,
    payment,
    adjustment,
    adjustmentPaise,
    totalPaise,
    cardRows,
    duePaise,
    coveredByCards,
    payNowPaise: Math.max(0, duePaise - input.laterPaise),
    shortfallPaise: digitalOnly ? 0 : minimumOrderShortfall(settings, ruleSubtotal),
    codBlocked,
    codNote,
  }
}

/** The trust line's ways to pay, once each: "UPI · Cards · Cash on delivery". */
export function trustMethodNames(methods: CheckoutMethod[]): string[] {
  const names = methods.flatMap((m): string[] => {
    if (m.id === 'decentro') return [content.methods.upi]
    if (m.id === 'cod') return [content.methods.cod]
    if (m.id === 'razorpay' || m.id === 'cashfree') {
      return m.methods?.length
        ? m.methods.flatMap((id) => content.onlineMethodNames[id] ?? [])
        : [content.methods.upi, content.onlineMethodNames.card ?? '']
    }
    return []
  })
  return [...new Set(names.filter(Boolean))]
}

/** One line under the PIN code field: the promise, or why the address will not work. */
export function deliveryLine(s: CheckoutShipping | null, checking: boolean): string | null {
  if (checking) return content.delivery.checking
  const d = s?.delivery
  if (!d?.ok) return null
  if (!d.serviceable) return content.delivery.unserviceable(d.pincode)
  if (s?.rates.kind === 'none') return content.delivery.noRates(d.pincode)
  // Several rates carry their own dates on the options below.
  if (s?.rates.kind === 'rates' && s.rates.options.length > 1) return null
  const own = s?.rates.kind === 'rates' ? s.rates.options[0]?.dateRange : null
  const range = own ?? d.dateRange
  return range ? content.delivery.estimate(range) : null
}

/**
 * The last day the order should arrive, for the green line under the PIN code
 * ("Gurugram, Haryana · by Thu, 29 Oct"): the picked option's dates, else the courier's
 * for this PIN code. A range ("Tue, 27 Oct - Thu, 29 Oct") gives its end.
 */
export function deliveryBy(
  s: CheckoutShipping | null,
  rate: CheckoutRate | undefined,
): string | null {
  const d = s?.delivery
  if (!d?.ok || !d.serviceable || s?.rates.kind === 'none') return null
  const range = rate?.dateRange ?? d.dateRange
  if (!range) return null
  return range.split(' - ').pop()?.trim() || null
}

/**
 * The payment fee the order will carry: a rate's own COD fee replaces the
 * store's, as `placeOrder` does. Preview only; the server decides.
 */
export function previewAdjustment(
  method: CheckoutMethod | undefined,
  rate: CheckoutRate | undefined,
): PaymentAdjustmentValue | undefined {
  if (method?.id !== 'cod' || rate?.codSurchargePaise == null) return method?.adjustment
  return { type: 'fixed', value: rate.codSurchargePaise, label: method.adjustment?.label }
}

/** The summary's shipping row: nothing to ship, not checked yet, or the picked rate. */
export function shippingRow(
  digitalOnly: boolean,
  s: CheckoutShipping | null,
  rate: CheckoutRate | undefined,
): ShippingRow | null {
  if (digitalOnly) return null
  if (s?.rates.kind === 'free') return { kind: 'price', paise: 0, name: null }
  if (!rate) return { kind: 'pending' }
  return { kind: 'price', paise: rate.pricePaise, name: rate.name }
}
