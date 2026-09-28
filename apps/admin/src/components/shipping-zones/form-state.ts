import type {
  PincodeRule,
  ShippingRateCondition,
  ShippingZoneWrite,
} from '@commerce/core/shipping-rates'
import type { shippingRatesContent } from '@/data/shipping-rates'
import type { api } from '@/lib/api-client'
import type { Formatters } from '@/lib/format'

export type LoadedZone = NonNullable<Awaited<ReturnType<typeof api.shipping.zones.get>>>
type LoadedRate = LoadedZone['rates'][number]

/** A rate as typed in the dialog: numbers stay strings so "12." survives. */
export type RateDraft = {
  /** Stable React key; the saved id when there is one. */
  key: string
  id?: string | undefined
  name: string
  condition: ShippingRateCondition
  /** Rupees for order value, grams for weight. */
  min: string
  max: string
  price: string
  freeAbove: string
  codFee: string
  minDays: string
  maxDays: string
}

export type ZoneFormState = {
  name: string
  stateCodes: string[]
  pincodeRules: PincodeRule[]
  rates: RateDraft[]
}

/** `shippingRatesContent` in the member's language, from `useCopy`. */
type RatesCopy = typeof shippingRatesContent

const rupees = (paise: number | null): string => (paise === null ? '' : String(paise / 100))
const text = (n: number | null): string => (n === null ? '' : String(n))

export function fromRate(r: LoadedRate): RateDraft {
  const money = r.condition === 'order_value'
  return {
    key: r.id,
    id: r.id,
    name: r.name,
    condition: r.condition,
    min: money ? rupees(r.minValue) : text(r.minValue),
    max: money ? rupees(r.maxValue) : text(r.maxValue),
    price: rupees(r.pricePaise),
    freeAbove: rupees(r.freeAbovePaise),
    codFee: rupees(r.codSurchargePaise),
    minDays: text(r.minTransitDays),
    maxDays: text(r.maxTransitDays),
  }
}

export function fromZone(zone: LoadedZone): ZoneFormState {
  return {
    name: zone.name,
    stateCodes: [...zone.stateCodes],
    pincodeRules: zone.pincodeRules.map((r) => ({ pattern: r.pattern, mode: r.mode })),
    rates: zone.rates.map(fromRate),
  }
}

export const emptyZone = (): ZoneFormState => ({
  name: '',
  stateCodes: [],
  pincodeRules: [],
  rates: [],
})

export const emptyRate = (key: string): RateDraft => ({
  key,
  name: '',
  condition: 'none',
  min: '',
  max: '',
  price: '',
  freeAbove: '',
  codFee: '',
  minDays: '',
  maxDays: '',
})

const num = (s: string): number | null => {
  const t = s.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : null
}
const paise = (s: string): number | null => {
  const n = num(s)
  return n === null ? null : Math.round(n * 100)
}
const whole = (s: string): number | null => {
  const n = num(s)
  return n === null ? null : Math.round(n)
}

/** The band bounds in the unit the server stores: paise for value, grams for weight. */
function bounds(r: RateDraft): { minValue: number | null; maxValue: number | null } {
  if (r.condition === 'none') return { minValue: null, maxValue: null }
  const read = r.condition === 'order_value' ? paise : whole
  return { minValue: read(r.min) ?? 0, maxValue: read(r.max) }
}

export function rateErrors(
  copy: RatesCopy,
  r: RateDraft,
): Partial<Record<'name' | 'price' | 'band' | 'transit', string>> {
  const errors: Partial<Record<'name' | 'price' | 'band' | 'transit', string>> = {}
  if (!r.name.trim()) errors.name = copy.rate.errors.name
  if (paise(r.price) === null) errors.price = copy.rate.errors.price
  const { minValue, maxValue } = bounds(r)
  if (minValue !== null && maxValue !== null && maxValue <= minValue) {
    errors.band = copy.rate.errors.band
  }
  const lo = whole(r.minDays)
  const hi = whole(r.maxDays)
  if (lo !== null && hi !== null && hi < lo) errors.transit = copy.rate.errors.transit
  return errors
}

export function toRateInput(r: RateDraft): ShippingZoneWrite['rates'][number] {
  return {
    ...(r.id ? { id: r.id } : {}),
    name: r.name.trim(),
    condition: r.condition,
    ...bounds(r),
    pricePaise: paise(r.price) ?? 0,
    freeAbovePaise: paise(r.freeAbove),
    codSurchargePaise: paise(r.codFee),
    minTransitDays: whole(r.minDays),
    maxTransitDays: whole(r.maxDays),
  }
}

export function toZoneInput(f: ZoneFormState): ShippingZoneWrite {
  return {
    name: f.name.trim(),
    stateCodes: f.stateCodes,
    pincodeRules: f.pincodeRules,
    rates: f.rates.map(toRateInput),
  }
}

/** "Any order", "Order value ₹0 to ₹499", "Weight 500 g and up". */
export function describeCondition(copy: RatesCopy, fmt: Formatters, r: RateDraft): string {
  const { minValue, maxValue } = bounds(r)
  if (r.condition === 'order_value') {
    return copy.zone.conditions.valueBand(
      fmt.money(minValue ?? 0),
      maxValue === null ? null : fmt.money(maxValue),
    )
  }
  if (r.condition === 'weight') {
    const g = (n: number) => `${n} ${copy.rate.grams}`
    return copy.zone.conditions.weightBand(g(minValue ?? 0), maxValue === null ? null : g(maxValue))
  }
  return copy.zone.conditions.none
}

/** "₹49 · Free above ₹999 · COD fee ₹29" for a rate row. */
export function describePrice(copy: RatesCopy, fmt: Formatters, r: RateDraft): string {
  const input = toRateInput(r)
  const parts = [input.pricePaise === 0 ? copy.zone.rates.free : fmt.money(input.pricePaise)]
  if (input.freeAbovePaise !== null) {
    parts.push(copy.zone.rates.freeAbove(fmt.money(input.freeAbovePaise)))
  }
  if (input.codSurchargePaise !== null) {
    parts.push(copy.zone.rates.codFee(fmt.money(input.codSurchargePaise)))
  }
  return parts.join(' · ')
}

export function describeDelivery(copy: RatesCopy, r: RateDraft): string {
  const lo = whole(r.minDays)
  const hi = whole(r.maxDays)
  if (lo === null || hi === null) return copy.zone.rates.courier
  return copy.zone.rates.days(lo, hi)
}
