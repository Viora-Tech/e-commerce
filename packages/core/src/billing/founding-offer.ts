/** SOURCE OF TRUTH: founding merchant offer — WHAT who gets it (the first 20 stores to sign up while it is open), the 30-day trial, and Growth at ₹999 a month for 12 full billing months, then the normal price / WHY one pure rule the sign-up, plan bills, quotes, AutoPay and the Plan & billing page all read (owner, 27 Nov 2026). Pure, client-safe. */
import { type BillingInterval, PLANS, type PlanId } from './plans'
import { gstOn } from './proration'

export const FOUNDING_OFFER = {
  /** New sign-ups can take a place. False closes it; places already taken keep their price. */
  open: true,
  /** The first this many stores to sign up. */
  slots: 20,
  /** Their trial, in place of the usual 14 days. */
  trialDays: 30,
  plan: 'growth' as PlanId,
  interval: 'month' as BillingInterval,
  /** Growth's monthly price for them, before GST (₹999 instead of ₹1,999). */
  pricePaise: 99_900,
  /** Full monthly bills paid at that price; the next one is at the normal price. */
  months: 12,
} as const

/** How the discount reads on the sales order and its GST invoice. */
export const FOUNDING_OFFER_LABEL = 'Founding offer'

/** What a store's plan row and paid bills say about the offer. */
export type FoundingState = {
  /** When it took a place; null when it has none. */
  foundingOfferAt: Date | null
  /** Full monthly bills paid at the founding price (prorated ones do not count). */
  monthsPaid: number
}

/** A sign-up takes a place while the offer is open and fewer than `slots` are taken. */
export const canTakeFoundingPlace = (taken: number, open: boolean = FOUNDING_OFFER.open): boolean =>
  open && taken < FOUNDING_OFFER.slots

/** Founding-priced months still to come; 0 without a place. */
export const foundingMonthsLeft = (s: FoundingState): number =>
  s.foundingOfferAt ? Math.max(0, FOUNDING_OFFER.months - s.monthsPaid) : 0

/** Whether a bill for `plan` and `interval` is at the founding price: monthly Growth only. */
export const foundingApplies = (
  s: FoundingState,
  plan: PlanId,
  interval: BillingInterval,
): boolean =>
  foundingMonthsLeft(s) > 0 && plan === FOUNDING_OFFER.plan && interval === FOUNDING_OFFER.interval

/** The plan's price before GST for this store: the founding price where it applies. */
export const planPriceFor = (s: FoundingState, plan: PlanId, interval: BillingInterval): number =>
  foundingApplies(s, plan, interval) ? FOUNDING_OFFER.pricePaise : PLANS[plan].pricePaise[interval]

/** A price before GST with 18% GST on top, as the GST-inclusive sales store charges it. */
export const withPlanGst = (paise: number): number => paise + gstOn(paise)

/**
 * The sales order for a founding month: the Growth line at its normal GST-inclusive price, less
 * this discount labelled "Founding offer", so the invoice shows both. ₹2,358.82 − ₹1,180.00 =
 * ₹1,178.82, which is ₹999 plus GST.
 */
export const foundingDiscountPaise = (): number =>
  withPlanGst(PLANS[FOUNDING_OFFER.plan].pricePaise[FOUNDING_OFFER.interval]) -
  withPlanGst(FOUNDING_OFFER.pricePaise)

/** The sales order note: `Founding offer: Growth at ₹999 a month, month 3 of 12`. */
export const foundingNote = (s: FoundingState): string =>
  `${FOUNDING_OFFER_LABEL}: Growth at ₹${FOUNDING_OFFER.pricePaise / 100} a month, month ${Math.min(
    FOUNDING_OFFER.months,
    s.monthsPaid + 1,
  )} of ${FOUNDING_OFFER.months}`

/** What the Plan & billing page shows; null without a place. */
export type FoundingView = {
  pricePaise: number
  listPricePaise: number
  monthsTotal: number
  monthsPaid: number
  monthsLeft: number
} | null

export function foundingView(s: FoundingState): FoundingView {
  if (!s.foundingOfferAt) return null
  return {
    pricePaise: FOUNDING_OFFER.pricePaise,
    listPricePaise: PLANS[FOUNDING_OFFER.plan].pricePaise[FOUNDING_OFFER.interval],
    monthsTotal: FOUNDING_OFFER.months,
    monthsPaid: Math.min(FOUNDING_OFFER.months, s.monthsPaid),
    monthsLeft: foundingMonthsLeft(s),
  }
}

/** The founding price for `plan` and `interval` from the page's view, or null at the normal price. */
export const foundingPriceOf = (
  v: FoundingView,
  plan: PlanId,
  interval: BillingInterval,
): number | null =>
  v && v.monthsLeft > 0 && plan === FOUNDING_OFFER.plan && interval === FOUNDING_OFFER.interval
    ? v.pricePaise
    : null
