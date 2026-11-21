/** SOURCE OF TRUTH: the 3 questions on the Options page and an option's page, as settings
 * WHAT:  "Who pays for delivery?" is `price.source`; "Can shoppers pick a faster courier?" is
 *        `couriers.max` 1 (No) or `couriers.extra` (`difference`, `full`); "Round prices to" is
 *        `price.rounding`. Also the made-up amounts the faster-courier cards name, and which
 *        "More settings" differ from their default (the "3 changed" count, and whether the
 *        disclosure starts open).
 * WHY:   Owner, 21 Nov 2026: the Options settings were "still so confusing"; the owner chose a
 *        3-question layout with everything else in one collapsed "More settings".
 * WHERE: delivery-questions.tsx, list-questions-card.tsx, option-questions-card.tsx,
 *        option-more-card.tsx, option-edit-card.tsx. Pure.
 */
import {
  type CourierExtra,
  type DeliveryOption,
  DeliveryOptionInputSchema,
  type PriceRounding,
} from '@commerce/core/delivery-options'
import { optionExample } from './option-example'
import { ALL_COURIERS, formOf, type OptionForm } from './option-form-state'

/** `couriers.max` for "No, show one courier only". */
export const ONE_COURIER = 1

export type WhoPays = DeliveryOption['price']['source']

/** Question 2's cards; `null` when the option charges nothing extra (set in More settings). */
export type FasterAnswer = 'no' | 'difference' | 'full'

type Couriers = Pick<DeliveryOption['couriers'], 'max' | 'extra'>

/** Question 2 from the saved couriers: one card is No; nothing extra is no card. */
export function fasterOf(c: Couriers): FasterAnswer | null {
  if (c.max === ONE_COURIER) return 'no'
  return c.extra === 'none' ? null : c.extra
}

/** Question 2 into the couriers: No caps the list at one; Yes shows every courier again. */
export function withFaster<C extends Couriers>(c: C, answer: FasterAnswer): C {
  if (answer === 'no') return { ...c, max: ONE_COURIER }
  return { ...c, extra: answer, max: c.max === ONE_COURIER ? null : c.max }
}

/** Question 3 into an option: a list's old "+₹…9" switch follows it (Off turns it off). */
export function withRounding(o: DeliveryOption, rounding: PriceRounding): DeliveryOption {
  return {
    ...o,
    price: { ...o.price, rounding },
    ...(o.couriers.show === 'list'
      ? { couriers: { ...o.couriers, roundTo9: rounding !== 'off' } }
      : {}),
  }
}

type Pricing = Pick<DeliveryOption, 'price' | 'couriers' | 'speed' | 'strategy'>

/**
 * What the faster courier costs in the example (Surface ₹43, Air ₹72): "+ ₹29" with the
 * difference, "₹79" at its full price. Null when the example's faster courier costs no more
 * (the included courier is already the fastest) or the price is a Shipping rate.
 */
export function fasterAmounts(o: Pricing): { extraPaise: number | null; fullPaise: number | null } {
  const as = (extra: CourierExtra) =>
    optionExample({ ...o, couriers: { ...o.couriers, show: 'list', max: null, extra } }).cards[1]
  const full = as('full')
  const fullPaise =
    full && full.pricePaise !== null && full.pricePaise > (as('none')?.pricePaise ?? 0)
      ? full.pricePaise
      : null
  return { extraPaise: as('difference')?.extraPaise ?? null, fullPaise }
}

const DEFAULTS = DeliveryOptionInputSchema.parse({ name: '-' })

/** The courier list's "More settings", each named once, in the order they show. */
export const LIST_MORE_KEYS = [
  'markup',
  'freeAbove',
  'min',
  'max',
  'included',
  'showAtMost',
  'hideSlower',
  'sameAsFirst',
  'insurance',
  'codFee',
] as const
export type ListMoreKey = (typeof LIST_MORE_KEYS)[number]

/** Which of the courier list's "More settings" differ from a new option's. */
export function listMoreChanged(o: DeliveryOption): ListMoreKey[] {
  const d = DEFAULTS
  const changed: Record<ListMoreKey, boolean> = {
    markup: o.price.markupPaise !== d.price.markupPaise || o.price.markupPercent !== 0,
    freeAbove: o.price.freeAbovePaise != null,
    min: o.price.minPaise != null,
    max: o.price.maxPaise != null,
    included: o.strategy !== d.strategy,
    showAtMost: o.couriers.max != null && o.couriers.max !== ONE_COURIER,
    hideSlower: o.couriers.hideSlowerDearer !== d.couriers.hideSlowerDearer,
    sameAsFirst: o.couriers.extra === 'none',
    insurance: o.insurance.default !== d.insurance.default || o.insurance.onlyAbovePaise != null,
    codFee: o.cod.fee !== d.cod.fee,
  }
  return LIST_MORE_KEYS.filter((k) => changed[k])
}

/**
 * The option page's "More settings": every form field that is not a question, nor name, speed
 * and status (shown above). Compared with a new option's form.
 */
const FORM_MORE_KEYS = [
  'markup',
  'markupPercent',
  'freeAbove',
  'min',
  'max',
  'strategy',
  'couriersList',
  'showNames',
  'couriersMax',
  'hideSlowerDearer',
  'roundTo9',
  'preferCarrier',
  'preferDirect',
  'routeMode',
  'insurance',
  'insuranceAbove',
  'cod',
  'codFee',
  'etaSource',
  'fixedMin',
  'fixedMax',
  'buffer',
  'processing',
  'maxDays',
  'couriersExtra',
] as const satisfies readonly (keyof OptionForm)[]

/** Which of the option page's "More settings" differ from a new option's. */
export function formMoreChanged(f: OptionForm): (keyof OptionForm)[] {
  const d = formOf(null)
  return FORM_MORE_KEYS.filter((k) => {
    // Question 2's answers are not More settings: only "nothing extra" is.
    if (k === 'couriersExtra') return f.couriersExtra === 'none'
    if (k === 'couriersMax') return f.couriersMax !== ALL_COURIERS && f.couriersMax !== '1'
    // Express is always prepaid only, so that is not a change.
    if (k === 'cod') return f.speed !== 'express' && f.cod !== d.cod
    // The "+₹…9" switch only shows (and counts) on the ₹10 rounding with the difference.
    if (k === 'roundTo9') return f.rounding === 'ten' && f.roundTo9 !== d.roundTo9
    return f[k] !== d[k]
  })
}

/** Question 2 on the option page's form. */
export function formFasterOf(f: OptionForm): FasterAnswer | null {
  if (f.couriersMax === String(ONE_COURIER)) return 'no'
  return f.couriersExtra === 'none' ? null : f.couriersExtra
}

/** Question 2 into the option page's form. */
export function formWithFaster(f: OptionForm, answer: FasterAnswer): OptionForm {
  if (answer === 'no') return { ...f, couriersMax: String(ONE_COURIER) }
  return {
    ...f,
    couriersExtra: answer,
    couriersMax: f.couriersMax === String(ONE_COURIER) ? ALL_COURIERS : f.couriersMax,
  }
}
