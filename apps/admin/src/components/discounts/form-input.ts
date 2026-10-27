import type { DiscountInput } from '@commerce/core/discounts'
import type { discountFormContent } from '@/data/discounts'
import { type DiscountFormState, fromLocalInput, scopeIds, usesPerProduct } from './form-state'

export type FormErrors = Partial<
  Record<
    | 'title'
    | 'code'
    | 'value'
    | 'products'
    | 'productValues'
    | 'buys'
    | 'buysItems'
    | 'gets'
    | 'getsItems'
    | 'states'
    | 'minimum'
    | 'eligibility'
    | 'dates',
    string
  >
>

type ErrorCopy = (typeof discountFormContent)['errors']

const num = (s: string): number => Number.parseFloat(s)
const rupeesToPaise = (s: string): number => Math.round(num(s) * 100)
const whole = (s: string): number => Number.parseInt(s, 10)
const positiveWhole = (s: string): boolean => Number.isInteger(num(s)) && whole(s) >= 1

/** A typed amount is usable: above zero, and at most 100 for a percent. */
export function validAmount(
  method: 'percent' | 'fixed' | 'free_shipping',
  raw: string | undefined,
): boolean {
  const n = num(raw ?? '')
  if (!Number.isFinite(n) || n <= 0) return false
  return method !== 'percent' || n <= 100
}

/** Typed value to stored units: basis points for a percent, paise for an amount. */
const toUnits = (method: DiscountFormState['method'], raw: string): number =>
  method === 'percent' ? Math.round(num(raw) * 100) : rupeesToPaise(raw)

/** What the "gets" items take off, as the stored method and value. */
function getsValue(f: DiscountFormState): Pick<DiscountInput, 'method' | 'value'> {
  if (f.getsMode === 'free') return { method: 'percent', value: 10_000 }
  return { method: f.getsMode, value: toUnits(f.getsMode, f.value) }
}

function valueErrors(f: DiscountFormState, copy: ErrorCopy, e: FormErrors): void {
  if (f.type === 'shipping') return
  if (f.type === 'bxgy') {
    if (f.getsMode !== 'free' && !validAmount(f.getsMode, f.value)) {
      e.value = f.getsMode === 'percent' ? copy.percent : copy.value
    }
    return
  }
  if (usesPerProduct(f)) {
    if (f.productIds.some((id) => !validAmount(f.method, f.productValues[id]))) {
      e.productValues = f.method === 'percent' ? copy.productPercents : copy.productValues
    }
  } else if (!validAmount(f.method, f.value)) {
    e.value = f.method === 'percent' ? copy.percent : copy.value
  }
}

function typeErrors(f: DiscountFormState, copy: ErrorCopy, e: FormErrors): void {
  if (f.type === 'products' && scopeIds(f).length === 0) {
    e.products = f.appliesTo === 'collections' ? copy.collections : copy.products
  }
  if (f.type === 'bxgy') {
    const buysOk =
      f.buysKind === 'quantity' ? positiveWhole(f.buysQuantity) : validAmount('fixed', f.buysAmount)
    if (!buysOk) e.buys = f.buysKind === 'quantity' ? copy.quantity : copy.value
    if (f.buysIds.length === 0) e.buysItems = copy.items
    if (!positiveWhole(f.getsQuantity)) e.gets = copy.quantity
    if (f.getsIds.length === 0) e.getsItems = copy.items
  }
  if (f.type === 'shipping') {
    if (!f.allStates && f.shippingStates.length === 0) e.states = copy.states
    if (f.excludeRates && !validAmount('fixed', f.maxShipping)) e.states = copy.value
  }
}

export function formErrors(f: DiscountFormState, copy: ErrorCopy): FormErrors {
  const e: FormErrors = {}
  if (!f.title.trim()) e.title = copy.title
  if (f.kind === 'code' && !/^[A-Za-z0-9-]{2,40}$/.test(f.code.trim())) e.code = copy.code
  valueErrors(f, copy, e)
  typeErrors(f, copy, e)
  if (f.type !== 'bxgy') {
    if (f.minimum === 'amount' && !validAmount('fixed', f.minSubtotal)) e.minimum = copy.value
    if (f.minimum === 'quantity' && !positiveWhole(f.minQuantity)) e.minimum = copy.quantity
  }
  if (f.eligibility === 'segments' && f.segmentIds.length === 0) e.eligibility = copy.segments
  if (f.eligibility === 'customers' && f.customerIds.length === 0) e.eligibility = copy.customers
  const start = fromLocalInput(f.startsAt)
  const end = f.hasEnd ? fromLocalInput(f.endsAt) : null
  if (f.hasEnd && start && end && end <= start) e.dates = copy.dates
  return e
}

export function toInput(f: DiscountFormState): DiscountInput {
  const limit = f.limitTotal ? whole(f.usageLimit) : Number.NaN
  const perProduct = usesPerProduct(f)
  const ids = scopeIds(f)
  const minimum = f.type === 'bxgy' ? 'none' : f.minimum
  const value =
    f.type === 'bxgy'
      ? getsValue(f)
      : f.type === 'shipping'
        ? { method: 'free_shipping' as const, value: 0 }
        : { method: f.method, value: perProduct ? 0 : toUnits(f.method, f.value) }
  return {
    type: f.type,
    title: f.title.trim(),
    kind: f.kind,
    code: f.kind === 'code' ? f.code.trim().toUpperCase() : null,
    ...value,
    minSubtotalPaise: minimum === 'amount' && f.minSubtotal ? rupeesToPaise(f.minSubtotal) : null,
    minQuantity: minimum === 'quantity' && f.minQuantity ? whole(f.minQuantity) : null,
    appliesTo: f.type === 'products' ? f.appliesTo : 'all',
    appliesToIds: f.type === 'products' ? ids : [],
    productValues: perProduct
      ? Object.fromEntries(
          f.productIds.map((id) => [id, toUnits(f.method, f.productValues[id] ?? '')]),
        )
      : null,
    bxgy:
      f.type === 'bxgy'
        ? {
            buys: {
              kind: f.buysKind,
              quantity: f.buysKind === 'quantity' ? whole(f.buysQuantity) || 0 : 0,
              amountPaise: f.buysKind === 'amount' ? rupeesToPaise(f.buysAmount) || 0 : 0,
              appliesTo: f.buysScope,
              ids: f.buysIds,
            },
            gets: { quantity: whole(f.getsQuantity) || 1, appliesTo: f.getsScope, ids: f.getsIds },
            maxUsesPerOrder:
              f.limitPerOrder && positiveWhole(f.maxUsesPerOrder) ? whole(f.maxUsesPerOrder) : null,
          }
        : null,
    shippingStates: f.type === 'shipping' && !f.allStates ? f.shippingStates : [],
    maxShippingPaise:
      f.type === 'shipping' && f.excludeRates && f.maxShipping
        ? rupeesToPaise(f.maxShipping)
        : null,
    customerEligibility: f.eligibility,
    eligibleIds:
      f.eligibility === 'segments'
        ? f.segmentIds
        : f.eligibility === 'customers'
          ? f.customerIds
          : [],
    combinesWith: f.combinesWith,
    usageLimit: Number.isFinite(limit) && limit > 0 ? limit : null,
    usagePerCustomer: f.onePerCustomer ? 1 : null,
    startsAt: fromLocalInput(f.startsAt),
    endsAt: f.hasEnd ? fromLocalInput(f.endsAt) : null,
    status: f.status,
  }
}
