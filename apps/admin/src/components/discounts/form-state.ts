import { type DiscountInput, perProductValues } from '@commerce/core/discounts'
import { discountFormContent } from '@/data/discounts'
import type { api } from '@/lib/api-client'

export type LoadedDiscount = NonNullable<Awaited<ReturnType<typeof api.discounts.get>>>

export type DiscountFormState = {
  title: string
  kind: 'code' | 'automatic'
  code: string
  method: 'percent' | 'fixed' | 'free_shipping'
  /** Percent as typed ("12.5") or rupees as typed ("200"); converted on save. */
  value: string
  appliesTo: 'all' | 'products' | 'collections'
  productIds: string[]
  collectionIds: string[]
  /** "Different amount for each product": each chosen product gets its own value. */
  perProduct: boolean
  /** Per-product value as typed, keyed by product id; same unit as `value`. */
  productValues: Record<string, string>
  hasMinimum: boolean
  minSubtotal: string
  limitTotal: boolean
  usageLimit: string
  onePerCustomer: boolean
  startsAt: string
  hasEnd: boolean
  endsAt: string
  status: 'active' | 'disabled'
}

export type FormErrors = Partial<
  Record<'title' | 'code' | 'value' | 'products' | 'productValues' | 'dates', string>
>

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** `datetime-local` wants local wall time without the zone. */
export function toLocalInput(d: Date | string | null): string {
  if (!d) return ''
  const date = new Date(d)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocalInput(s: string): Date | null {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

export function randomCode(length = 8): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

export function emptyForm(): DiscountFormState {
  return {
    title: '',
    kind: 'code',
    code: '',
    method: 'percent',
    value: '',
    appliesTo: 'all',
    productIds: [],
    collectionIds: [],
    perProduct: false,
    productValues: {},
    hasMinimum: false,
    minSubtotal: '',
    limitTotal: false,
    usageLimit: '',
    onePerCustomer: false,
    startsAt: toLocalInput(new Date()),
    hasEnd: false,
    endsAt: '',
    status: 'active',
  }
}

export function fromDiscount(d: LoadedDiscount): DiscountFormState {
  return {
    title: d.title,
    kind: d.kind,
    code: d.code ?? '',
    method: d.method,
    value:
      d.method === 'percent'
        ? String(d.value / 100)
        : d.method === 'fixed'
          ? String(d.value / 100)
          : '',
    appliesTo: d.appliesTo,
    productIds: d.appliesTo === 'products' ? d.appliesToIds : [],
    collectionIds: d.appliesTo === 'collections' ? d.appliesToIds : [],
    perProduct: perProductValues(d) !== null,
    productValues: Object.fromEntries(
      Object.entries(perProductValues(d) ?? {}).map(([id, v]) => [id, String(v / 100)]),
    ),
    hasMinimum: d.minSubtotalPaise !== null,
    minSubtotal: d.minSubtotalPaise !== null ? String(d.minSubtotalPaise / 100) : '',
    limitTotal: d.usageLimit !== null,
    usageLimit: d.usageLimit !== null ? String(d.usageLimit) : '',
    onePerCustomer: d.usagePerCustomer === 1,
    startsAt: toLocalInput(d.startsAt),
    hasEnd: d.endsAt !== null,
    endsAt: toLocalInput(d.endsAt),
    status: d.status,
  }
}

const num = (s: string): number => Number.parseFloat(s)
const rupeesToPaise = (s: string): number => Math.round(num(s) * 100)

/** Whether the form takes a different amount off each product. */
export function usesPerProduct(
  f: Pick<DiscountFormState, 'appliesTo' | 'method' | 'perProduct'>,
): boolean {
  return f.appliesTo === 'products' && f.method !== 'free_shipping' && f.perProduct
}

/** A typed amount is usable: above zero, and at most 100 for a percent. */
export function validAmount(method: DiscountFormState['method'], raw: string | undefined): boolean {
  const n = num(raw ?? '')
  if (!Number.isFinite(n) || n <= 0) return false
  return method !== 'percent' || n <= 100
}

/** Typed value to stored units: basis points for a percent, paise for an amount. */
const toUnits = (method: DiscountFormState['method'], raw: string): number =>
  method === 'percent' ? Math.round(num(raw) * 100) : rupeesToPaise(raw)

export function formErrors(f: DiscountFormState): FormErrors {
  const e: FormErrors = {}
  const copy = discountFormContent.errors
  if (!f.title.trim()) e.title = copy.title
  if (f.kind === 'code' && !/^[A-Za-z0-9-]{2,40}$/.test(f.code.trim())) e.code = copy.code
  if (usesPerProduct(f)) {
    if (f.productIds.some((id) => !validAmount(f.method, f.productValues[id]))) {
      e.productValues = f.method === 'percent' ? copy.productPercents : copy.productValues
    }
  } else if (f.method === 'percent') {
    if (!validAmount(f.method, f.value)) e.value = copy.percent
  } else if (f.method === 'fixed') {
    if (!validAmount(f.method, f.value)) e.value = copy.value
  }
  if (f.appliesTo === 'products' && f.productIds.length === 0) e.products = copy.products
  if (f.appliesTo === 'collections' && f.collectionIds.length === 0) e.products = copy.collections
  const start = fromLocalInput(f.startsAt)
  const end = f.hasEnd ? fromLocalInput(f.endsAt) : null
  if (f.hasEnd && start && end && end <= start) e.dates = copy.dates
  return e
}

export function toInput(f: DiscountFormState): DiscountInput {
  const limit = f.limitTotal ? Number.parseInt(f.usageLimit, 10) : Number.NaN
  const perProduct = usesPerProduct(f)
  return {
    title: f.title.trim(),
    kind: f.kind,
    code: f.kind === 'code' ? f.code.trim().toUpperCase() : null,
    method: f.method,
    value: f.method === 'free_shipping' || perProduct ? 0 : toUnits(f.method, f.value),
    minSubtotalPaise: f.hasMinimum && f.minSubtotal ? rupeesToPaise(f.minSubtotal) : null,
    appliesTo: f.appliesTo,
    appliesToIds:
      f.appliesTo === 'products'
        ? f.productIds
        : f.appliesTo === 'collections'
          ? f.collectionIds
          : [],
    productValues: perProduct
      ? Object.fromEntries(
          f.productIds.map((id) => [id, toUnits(f.method, f.productValues[id] ?? '')]),
        )
      : null,
    usageLimit: Number.isFinite(limit) && limit > 0 ? limit : null,
    shippingStates: [],
    customerEligibility: 'all',
    eligibleIds: [],
    combinesWith: { products: false, order: false, shipping: false },
    usagePerCustomer: f.onePerCustomer ? 1 : null,
    startsAt: fromLocalInput(f.startsAt),
    endsAt: f.hasEnd ? fromLocalInput(f.endsAt) : null,
    status: f.status,
  }
}
