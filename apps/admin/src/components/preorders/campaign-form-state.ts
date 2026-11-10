import type { PreorderCampaignCreateInput, PreorderCampaignView } from '@commerce/core'
import { rupees } from '@/data/products'

type Terms = PreorderCampaignView

/** A campaign as the form edits it: numbers as typed, money in rupees. */
export type CampaignFormState = {
  name: string
  status: Terms['status']
  /** `yyyy-mm-dd`; blank uses "ships in N days". */
  shipDate: string
  shipsInDays: string
  limit: string
  paymentMode: Terms['paymentMode']
  deposit: string
  depositPercent: string
  discountType: Terms['discountType']
  /** Percent or rupees, by `discountType`. */
  discountValue: string
  marketIds: string[]
  locationIds: string[]
  channels: Terms['channels']
  mixedCart: Terms['mixedCart']
  soldOutInCart: Terms['soldOutInCart']
  content: {
    buttonText: string
    badgeText: string
    productNote: string
    cartLineText: string
    orderNote: string
    blockMessage: string
  }
  design: {
    buttonBackground: string
    buttonText: string
    badgeBackground: string
    badgeText: string
  }
  productIds: string[]
  /** Per product (#1473): picked variants (null: all) and its own limit as typed ('' = the campaign's). */
  members: Record<string, { variantIds: string[] | null; limit: string }>
}

const num = (n: number | null) => (n == null ? '' : String(n))

/** `yyyy-mm-dd` of a stored date, in the admin's own calendar day. */
function toDateField(d: Date | string | null): string {
  if (!d) return ''
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function emptyCampaign(): CampaignFormState {
  return {
    name: '',
    status: 'active',
    shipDate: '',
    shipsInDays: '',
    limit: '',
    paymentMode: 'full',
    deposit: '',
    depositPercent: '',
    discountType: 'none',
    discountValue: '',
    marketIds: [],
    locationIds: [],
    channels: ['online_store', 'social', 'ai_agents'],
    mixedCart: 'split',
    soldOutInCart: 'preorder',
    content: {
      buttonText: '',
      badgeText: '',
      productNote: '',
      cartLineText: '',
      orderNote: '',
      blockMessage: '',
    },
    design: { buttonBackground: '', buttonText: '', badgeBackground: '', badgeText: '' },
    productIds: [],
    members: {},
  }
}

export function fromCampaign(c: Terms): CampaignFormState {
  return {
    name: c.name,
    status: c.status,
    shipDate: toDateField(c.shipDate),
    shipsInDays: num(c.shipsInDays),
    limit: num(c.limit),
    paymentMode: c.paymentMode,
    deposit: rupees.toField(c.depositPaise),
    depositPercent: num(c.depositPercent),
    discountType: c.discountType,
    discountValue:
      c.discountType === 'fixed' ? rupees.toField(c.discountValue) : num(c.discountValue),
    marketIds: c.marketIds,
    locationIds: c.locationIds,
    channels: c.channels,
    mixedCart: c.mixedCart,
    soldOutInCart: c.soldOutInCart,
    content: {
      buttonText: c.content.buttonText ?? '',
      badgeText: c.content.badgeText ?? '',
      productNote: c.content.productNote ?? '',
      cartLineText: c.content.cartLineText ?? '',
      orderNote: c.content.orderNote ?? '',
      blockMessage: c.content.blockMessage ?? '',
    },
    design: {
      buttonBackground: c.design.buttonBackground ?? '',
      buttonText: c.design.buttonText ?? '',
      badgeBackground: c.design.badgeBackground ?? '',
      badgeText: c.design.badgeText ?? '',
    },
    productIds: c.productIds,
    members: Object.fromEntries(
      c.members.map((m) => [m.productId, { variantIds: m.variantIds, limit: num(m.limit) }]),
    ),
  }
}

/** A typed whole number above zero (or zero when `zero`), null when blank; NaN when it is not one. */
function whole(value: string, zero = false): number | null {
  const t = value.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isInteger(n) && (zero ? n >= 0 : n > 0) ? n : Number.NaN
}

const blankless = <T extends Record<string, string>>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v.trim() !== '')) as Partial<T>

/** The API input, or null when a number does not read. */
export function toCampaignInput(form: CampaignFormState): PreorderCampaignCreateInput | null {
  const shipsInDays = whole(form.shipsInDays, true)
  const limit = whole(form.limit)
  const depositPercent = form.paymentMode === 'percentage' ? whole(form.depositPercent) : null
  const depositPaise = form.paymentMode === 'fixed' ? rupees.toPaise(form.deposit) : null
  const discountValue =
    form.discountType === 'none'
      ? null
      : form.discountType === 'fixed'
        ? rupees.toPaise(form.discountValue)
        : whole(form.discountValue)
  const members = form.productIds.map((productId) => {
    const m = form.members[productId]
    return {
      productId,
      variantIds: m?.variantIds ?? null,
      limit: m && m.limit.trim() !== '' ? whole(m.limit) : null,
    }
  })
  const numbers = [
    shipsInDays,
    limit,
    depositPercent,
    depositPaise,
    discountValue,
    ...members.map((m) => m.limit),
  ]
  if (numbers.some((n) => n !== null && Number.isNaN(n))) return null
  if (form.paymentMode === 'fixed' && !depositPaise) return null
  if (form.discountType !== 'none' && !discountValue) return null
  return {
    name: form.name.trim(),
    status: form.status,
    shipDate: form.shipDate ? new Date(`${form.shipDate}T00:00:00`) : null,
    shipsInDays,
    limit,
    paymentMode: form.paymentMode,
    depositPaise,
    depositPercent,
    discountType: form.discountType,
    discountValue,
    marketIds: form.marketIds,
    locationIds: form.locationIds,
    channels: form.channels,
    mixedCart: form.mixedCart,
    soldOutInCart: form.soldOutInCart,
    content: blankless(form.content),
    design: blankless(form.design),
    productIds: form.productIds,
    members,
  }
}
