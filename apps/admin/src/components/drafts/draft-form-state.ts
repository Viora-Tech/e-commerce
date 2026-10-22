import type { api } from '@/lib/api-client'

type Draft = NonNullable<Awaited<ReturnType<typeof api.orders.getDraft>>>

export type DraftLine = {
  variantId: string
  title: string
  variantTitle: string
  sku: string | null
  quantity: number
  unitPricePaise: number
  imageUrl?: string | null
  /** A gift card ships nothing; any other line needs a shipping address before converting. */
  giftCard: boolean
}

export type DraftFormState = {
  customerId: string | null
  customerName: string
  email: string
  phone: string
  address: {
    name: string
    line1: string
    line2: string
    city: string
    stateCode: string
    pincode: string
    phone: string
  }
  lines: DraftLine[]
  discountPaise: number
  discountLabel: string
  shippingPaise: number
  paymentMethod: string
  note: string
}

export const EMPTY_ADDRESS: DraftFormState['address'] = {
  name: '',
  line1: '',
  line2: '',
  city: '',
  stateCode: 'HR',
  pincode: '',
  phone: '',
}

export const emptyDraft = (): DraftFormState => ({
  customerId: null,
  customerName: '',
  email: '',
  phone: '',
  address: { ...EMPTY_ADDRESS },
  lines: [],
  discountPaise: 0,
  discountLabel: '',
  shippingPaise: 0,
  paymentMethod: 'manual',
  note: '',
})

export function draftToForm(d: Draft): DraftFormState {
  return {
    customerId: d.customerId,
    customerName: d.customer?.name ?? '',
    email: d.email ?? '',
    phone: d.phone ?? '',
    address: d.shippingAddress
      ? {
          name: d.shippingAddress.name,
          line1: d.shippingAddress.line1,
          line2: d.shippingAddress.line2 ?? '',
          city: d.shippingAddress.city,
          stateCode: d.shippingAddress.stateCode,
          pincode: d.shippingAddress.pincode,
          phone: d.shippingAddress.phone,
        }
      : { ...EMPTY_ADDRESS },
    lines: d.lines.map((l) => ({
      variantId: l.variantId,
      title: l.title ?? '',
      variantTitle: l.variantTitle ?? '',
      sku: l.sku ?? null,
      quantity: l.quantity,
      unitPricePaise: l.unitPricePaise,
      giftCard: l.giftCard,
    })),
    discountPaise: d.discountPaise,
    discountLabel: d.discountLabel ?? '',
    shippingPaise: d.shippingPaise,
    paymentMethod: d.paymentMethod ?? 'manual',
    note: d.note,
  }
}

/** Only an address with the required parts is sent; a half-typed one is dropped. */
function addressPayload(a: DraftFormState['address']) {
  const complete =
    a.name && a.line1 && a.city && a.stateCode && /^\d{6}$/.test(a.pincode) && a.phone
  if (!complete) return null
  return {
    name: a.name,
    line1: a.line1,
    ...(a.line2 ? { line2: a.line2 } : {}),
    city: a.city,
    stateCode: a.stateCode,
    pincode: a.pincode,
    phone: a.phone,
  }
}

/** Something in the draft ships, and there is no complete address to ship it to. */
export const draftMissingAddress = (f: DraftFormState): boolean =>
  f.lines.some((l) => !l.giftCard) && addressPayload(f.address) === null

export function formToDraft(f: DraftFormState) {
  return {
    customerId: f.customerId,
    email: f.email || null,
    phone: f.phone || null,
    customerName: f.customerName || null,
    shipping: addressPayload(f.address),
    lines: f.lines.map((l) => ({
      variantId: l.variantId,
      quantity: l.quantity,
      unitPricePaise: l.unitPricePaise,
    })),
    discountPaise: f.discountPaise,
    discountLabel: f.discountLabel || null,
    shippingPaise: f.shippingPaise,
    paymentMethod: f.paymentMethod || null,
    note: f.note || null,
  }
}

export const draftSubtotal = (lines: DraftLine[]): number =>
  lines.reduce((sum, l) => sum + l.quantity * l.unitPricePaise, 0)

export function draftTotals(f: DraftFormState) {
  const subtotalPaise = draftSubtotal(f.lines)
  const discountPaise = Math.min(f.discountPaise, subtotalPaise)
  return {
    subtotalPaise,
    discountPaise,
    totalPaise: subtotalPaise - discountPaise + f.shippingPaise,
  }
}
