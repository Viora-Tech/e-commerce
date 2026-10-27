import { discountType, perProductValues } from '@commerce/core/discounts'
import { DEFAULT_TIME_ZONE, wallClock, zoneOffsetMs } from '@commerce/dates'
import type { api } from '@/lib/api-client'

export type LoadedDiscount = NonNullable<Awaited<ReturnType<typeof api.discounts.get>>>

export type DiscountType = 'products' | 'order' | 'bxgy' | 'shipping'
export type ItemScope = 'products' | 'collections'

export type DiscountFormState = {
  /** Shopify's four types; picked when the discount is created. */
  type: DiscountType
  title: string
  kind: 'code' | 'automatic'
  code: string
  /** Percent or a fixed amount off; free shipping for the shipping type. */
  method: 'percent' | 'fixed' | 'free_shipping'
  /** Percent as typed ("12.5") or rupees as typed ("200"); converted on save. */
  value: string
  /** Amount off products: which products or collections. */
  appliesTo: ItemScope
  productIds: string[]
  collectionIds: string[]
  /** "Different amount for each product": each chosen product gets its own value. */
  perProduct: boolean
  /** Per-product value as typed, keyed by product id; same unit as `value`. */
  productValues: Record<string, string>
  /** Buy X get Y: what the shopper buys. */
  buysKind: 'quantity' | 'amount'
  buysQuantity: string
  buysAmount: string
  buysScope: ItemScope
  buysIds: string[]
  /** Buy X get Y: what the shopper gets, and at what discount. */
  getsQuantity: string
  getsScope: ItemScope
  getsIds: string[]
  getsMode: 'free' | 'percent' | 'fixed'
  limitPerOrder: boolean
  maxUsesPerOrder: string
  /** Free shipping: every state or the ticked ones, and the rate cap. */
  allStates: boolean
  shippingStates: string[]
  excludeRates: boolean
  maxShipping: string
  minimum: 'none' | 'amount' | 'quantity'
  minSubtotal: string
  minQuantity: string
  eligibility: 'all' | 'segments' | 'customers'
  segmentIds: string[]
  customerIds: string[]
  combinesWith: { products: boolean; order: boolean; shipping: boolean }
  limitTotal: boolean
  usageLimit: string
  onePerCustomer: boolean
  startsAt: string
  hasEnd: boolean
  endsAt: string
  status: 'active' | 'disabled'
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * `datetime-local` wants wall time without the zone. It is the store's wall time
 * (Asia/Kolkata), never the runtime's: the page is first rendered on the server (UTC), and a
 * runtime-zone value shifted start and end times by 5:30 between server and browser.
 */
export function toLocalInput(d: Date | string | null): string {
  if (!d) return ''
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  // wallClock's UTC fields read the store zone's clock: "YYYY-MM-DDTHH:mm".
  return wallClock(date, DEFAULT_TIME_ZONE).toISOString().slice(0, 16)
}

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/

/** The instant a `datetime-local` value means in the store's zone; null when blank or invalid. */
export function fromLocalInput(s: string): Date | null {
  const m = LOCAL_INPUT.exec(s)
  if (!m) return null
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number]
  const asUtc = new Date(Date.UTC(y, mo - 1, d, h, mi))
  if (Number.isNaN(asUtc.getTime())) return null
  return new Date(asUtc.getTime() - zoneOffsetMs(asUtc, DEFAULT_TIME_ZONE))
}

export function randomCode(length = 8): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

export function emptyForm(type: DiscountType = 'products'): DiscountFormState {
  return {
    type,
    title: '',
    kind: 'code',
    code: '',
    method: type === 'shipping' ? 'free_shipping' : 'percent',
    value: '',
    appliesTo: 'collections',
    productIds: [],
    collectionIds: [],
    perProduct: false,
    productValues: {},
    buysKind: 'quantity',
    buysQuantity: '1',
    buysAmount: '',
    buysScope: 'products',
    buysIds: [],
    getsQuantity: '1',
    getsScope: 'products',
    getsIds: [],
    getsMode: 'free',
    limitPerOrder: false,
    maxUsesPerOrder: '',
    allStates: true,
    shippingStates: [],
    excludeRates: false,
    maxShipping: '',
    minimum: 'none',
    minSubtotal: '',
    minQuantity: '',
    eligibility: 'all',
    segmentIds: [],
    customerIds: [],
    combinesWith: { products: false, order: false, shipping: false },
    limitTotal: false,
    usageLimit: '',
    onePerCustomer: false,
    startsAt: toLocalInput(new Date()),
    hasEnd: false,
    endsAt: '',
    status: 'active',
  }
}

const rupees = (paise: number | null | undefined): string =>
  paise === null || paise === undefined ? '' : String(paise / 100)

/** Typed rupees, or percent from basis points: both are stored in hundredths. */
const typed = (stored: number): string => String(stored / 100)

export function fromDiscount(d: LoadedDiscount): DiscountFormState {
  const type = discountType(d)
  const base = emptyForm(type)
  const values = perProductValues(d)
  const bxgy = type === 'bxgy' ? d.bxgy : null
  const free = Boolean(bxgy) && d.method === 'percent' && d.value === 10_000
  const scope: ItemScope = d.appliesTo === 'products' ? 'products' : 'collections'
  return {
    ...base,
    title: d.title,
    kind: d.kind,
    code: d.code ?? '',
    method: d.method,
    value: d.method === 'free_shipping' || free ? '' : typed(d.value),
    appliesTo: scope,
    productIds: d.appliesTo === 'products' ? d.appliesToIds : [],
    collectionIds: d.appliesTo === 'collections' ? d.appliesToIds : [],
    perProduct: values !== null,
    productValues: Object.fromEntries(
      Object.entries(values ?? {}).map(([id, v]) => [id, typed(v)]),
    ),
    ...(bxgy
      ? {
          buysKind: bxgy.buys.kind,
          buysQuantity: bxgy.buys.kind === 'quantity' ? String(bxgy.buys.quantity) : '1',
          buysAmount: bxgy.buys.kind === 'amount' ? rupees(bxgy.buys.amountPaise) : '',
          buysScope: bxgy.buys.appliesTo,
          buysIds: bxgy.buys.ids,
          getsQuantity: String(bxgy.gets.quantity),
          getsScope: bxgy.gets.appliesTo,
          getsIds: bxgy.gets.ids,
          getsMode: free
            ? ('free' as const)
            : d.method === 'fixed'
              ? ('fixed' as const)
              : ('percent' as const),
          limitPerOrder: bxgy.maxUsesPerOrder !== null,
          maxUsesPerOrder: bxgy.maxUsesPerOrder === null ? '' : String(bxgy.maxUsesPerOrder),
        }
      : {}),
    allStates: d.shippingStates.length === 0,
    shippingStates: d.shippingStates,
    excludeRates: d.maxShippingPaise !== null,
    maxShipping: rupees(d.maxShippingPaise),
    minimum: d.minSubtotalPaise !== null ? 'amount' : d.minQuantity !== null ? 'quantity' : 'none',
    minSubtotal: rupees(d.minSubtotalPaise),
    minQuantity: d.minQuantity === null ? '' : String(d.minQuantity),
    eligibility: d.customerEligibility,
    segmentIds: d.customerEligibility === 'segments' ? d.eligibleIds : [],
    customerIds: d.customerEligibility === 'customers' ? d.eligibleIds : [],
    combinesWith: { ...base.combinesWith, ...d.combinesWith },
    limitTotal: d.usageLimit !== null,
    usageLimit: d.usageLimit !== null ? String(d.usageLimit) : '',
    onePerCustomer: d.usagePerCustomer === 1,
    startsAt: toLocalInput(d.startsAt),
    hasEnd: d.endsAt !== null,
    endsAt: toLocalInput(d.endsAt),
    status: d.status,
  }
}

/** Whether the form takes a different amount off each product. */
export function usesPerProduct(
  f: Pick<DiscountFormState, 'type' | 'appliesTo' | 'method' | 'perProduct'>,
): boolean {
  return (
    f.type === 'products' &&
    f.appliesTo === 'products' &&
    f.method !== 'free_shipping' &&
    f.perProduct
  )
}

/** The ids the products discount points at, for its current scope. */
export const scopeIds = (
  f: Pick<DiscountFormState, 'appliesTo' | 'productIds' | 'collectionIds'>,
) => (f.appliesTo === 'products' ? f.productIds : f.collectionIds)
