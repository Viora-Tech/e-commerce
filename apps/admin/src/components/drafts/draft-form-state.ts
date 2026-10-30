import { validateGstin } from '@commerce/core/gstin'
import type { api } from '@/lib/api-client'

type Draft = NonNullable<Awaited<ReturnType<typeof api.orders.getDraft>>>

type Found = NonNullable<Awaited<ReturnType<typeof api.customers.get>>>

type SavedAddress = Found['addresses'][number]

/** The server's answer for a discount code on this draft (`orders.checkDraftDiscount`). */
export type DraftCodeCheck = Awaited<ReturnType<typeof api.orders.checkDraftDiscount>>

/** A one-off line not in the catalogue (audit #28). */
export type DraftCustomItem = {
  /** False: no GST on this line. */
  taxable: boolean
  /** Optional HSN printed on the invoice; '' for none. */
  hsCode: string
}

export type DraftLine = {
  /** Tells lines apart: the variant id, or a generated id for a custom item. */
  key: string
  /** '' on a custom item. */
  variantId: string
  title: string
  variantTitle: string
  sku: string | null
  quantity: number
  unitPricePaise: number
  imageUrl?: string | null
  /** A gift card ships nothing; any other line needs a shipping address before converting. */
  giftCard: boolean
  /** Set on a custom item; its title is `title`. */
  custom?: DraftCustomItem
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
  /** "Billing address is the same as shipping"; on for a new draft. */
  billingSameAsShipping: boolean
  /** The billing address when it differs: the shipping parts plus a company and its GSTIN. */
  billing: DraftFormState['address'] & { businessName: string; gstin: string }
  lines: DraftLine[]
  discountPaise: number
  discountLabel: string
  /** A store discount code; when set it replaces the manual discount. '' for none. */
  discountCode: string
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

export const EMPTY_BILLING: DraftFormState['billing'] = {
  ...EMPTY_ADDRESS,
  businessName: '',
  gstin: '',
}

export const emptyDraft = (): DraftFormState => ({
  customerId: null,
  customerName: '',
  email: '',
  phone: '',
  address: { ...EMPTY_ADDRESS },
  billingSameAsShipping: true,
  billing: { ...EMPTY_BILLING },
  lines: [],
  discountPaise: 0,
  discountLabel: '',
  discountCode: '',
  shippingPaise: 0,
  paymentMethod: 'manual',
  note: '',
})

type AddressRow = {
  name: string
  line1: string
  line2: string | null
  city: string
  stateCode: string
  pincode: string
  phone: string
}

/** A saved address (an order snapshot or a customer's book entry) as the form's fields. */
export const addressToForm = (a: AddressRow): DraftFormState['address'] => ({
  name: a.name,
  line1: a.line1,
  line2: a.line2 ?? '',
  city: a.city,
  stateCode: a.stateCode,
  pincode: a.pincode,
  phone: a.phone,
})

/**
 * The billing half of the form: the draft's own billing address, else (a GSTIN with no
 * separate address, e.g. a duplicated checkout order) the shipping address carrying that
 * GSTIN, so saving keeps it; otherwise billing is the shipping address.
 */
function billingToForm(d: Draft): Pick<DraftFormState, 'billingSameAsShipping' | 'billing'> {
  const place = d.billingAddress ?? (d.buyerGstin ? d.shippingAddress : null)
  if (!place) return { billingSameAsShipping: true, billing: { ...EMPTY_BILLING } }
  return {
    billingSameAsShipping: false,
    billing: {
      ...addressToForm(place),
      businessName: d.buyerBusinessName ?? '',
      gstin: d.buyerGstin ?? '',
    },
  }
}

export function draftToForm(d: Draft): DraftFormState {
  return {
    customerId: d.customerId,
    customerName: d.customer?.name ?? '',
    email: d.email ?? '',
    phone: d.phone ?? '',
    address: d.shippingAddress ? addressToForm(d.shippingAddress) : { ...EMPTY_ADDRESS },
    ...billingToForm(d),
    lines: d.lines.map((l, i) =>
      l.custom
        ? {
            key: `custom:${i}`,
            variantId: '',
            title: l.title ?? '',
            variantTitle: '',
            sku: null,
            quantity: l.quantity,
            unitPricePaise: l.unitPricePaise,
            giftCard: false,
            custom: { taxable: l.gstRatePercent !== 0, hsCode: l.hsCode ?? '' },
          }
        : {
            key: l.variantId,
            variantId: l.variantId,
            title: l.title ?? '',
            variantTitle: l.variantTitle ?? '',
            sku: l.sku ?? null,
            quantity: l.quantity,
            unitPricePaise: l.unitPricePaise,
            giftCard: l.giftCard,
          },
    ),
    // A code's amount and label come from the code; the manual fields start empty beside it.
    discountPaise: d.discountCode ? 0 : d.discountPaise,
    discountLabel: d.discountCode ? '' : (d.discountLabel ?? ''),
    discountCode: d.discountCode ?? '',
    shippingPaise: d.shippingPaise,
    paymentMethod: d.paymentMethod ?? 'manual',
    note: d.note,
  }
}

/** The parts an address needs before an order can ship to it, in form order. */
export type AddressPart = 'name' | 'line1' | 'city' | 'stateCode' | 'pincode' | 'phone'

/**
 * What the address still lacks. Its phone may be left blank when the customer's phone is
 * filled in: that number is used (#844: the draft could not be converted because the phone
 * was only typed in the Customer card).
 */
export function missingAddressParts(
  a: DraftFormState['address'],
  fallbackPhone = '',
): AddressPart[] {
  const missing: AddressPart[] = []
  if (!a.name.trim()) missing.push('name')
  if (!a.line1.trim()) missing.push('line1')
  if (!a.city.trim()) missing.push('city')
  if (!a.stateCode) missing.push('stateCode')
  if (!/^\d{6}$/.test(a.pincode.trim())) missing.push('pincode')
  if (!a.phone.trim() && !fallbackPhone.trim()) missing.push('phone')
  return missing
}

/** Only an address with the required parts is sent; a half-typed one is dropped. */
function addressPayload(a: DraftFormState['address'], fallbackPhone = '') {
  if (missingAddressParts(a, fallbackPhone).length > 0) return null
  const phone = a.phone.trim() || fallbackPhone.trim()
  return {
    name: a.name,
    line1: a.line1,
    ...(a.line2 ? { line2: a.line2 } : {}),
    city: a.city,
    stateCode: a.stateCode,
    pincode: a.pincode.trim(),
    phone,
  }
}

/** The GSTIN typed on the billing address fails the check (blank is fine: no GSTIN). */
export const billingGstinInvalid = (f: DraftFormState): boolean =>
  !f.billingSameAsShipping && f.billing.gstin.trim() !== '' && !validateGstin(f.billing.gstin).ok

/** "Same as shipping" is off and the billing address is not complete (or its GSTIN is wrong). */
export const draftIncompleteBilling = (f: DraftFormState): boolean =>
  !f.billingSameAsShipping &&
  (addressPayload(f.billing, f.phone) === null || billingGstinInvalid(f))

/** What the draft says about billing: the same as shipping, a billing address, or nothing yet. */
function billingPayload(f: DraftFormState) {
  if (f.billingSameAsShipping) return { billingSameAsShipping: true }
  const place = addressPayload(f.billing, f.phone)
  if (!place || billingGstinInvalid(f)) return {}
  return {
    billingSameAsShipping: false,
    billing: {
      ...place,
      businessName: f.billing.businessName.trim() || null,
      gstin: f.billing.gstin.trim() || null,
    },
  }
}

/** Something in the draft ships, and there is no complete address to ship it to. */
export const draftMissingAddress = (f: DraftFormState): boolean =>
  f.lines.some((l) => !l.giftCard) && addressPayload(f.address, f.phone) === null

/** One line as the server takes it: a catalogue variant, or a custom item with its own price. */
export const linePayload = (l: DraftLine) =>
  l.custom
    ? {
        custom: {
          title: l.title.trim(),
          taxable: l.custom.taxable,
          hsCode: l.custom.hsCode || null,
        },
        quantity: l.quantity,
        unitPricePaise: l.unitPricePaise,
      }
    : { variantId: l.variantId, quantity: l.quantity, unitPricePaise: l.unitPricePaise }

export function formToDraft(f: DraftFormState) {
  return {
    customerId: f.customerId,
    email: f.email || null,
    phone: f.phone || null,
    customerName: f.customerName || null,
    shipping: addressPayload(f.address, f.phone),
    ...billingPayload(f),
    lines: f.lines.map(linePayload),
    discountPaise: f.discountPaise,
    discountLabel: f.discountLabel || null,
    discountCode: f.discountCode || null,
    shippingPaise: f.shippingPaise,
    paymentMethod: f.paymentMethod || null,
    note: f.note || null,
  }
}

/** A saved draft's code as it was applied on the last save, until the re-check answers. */
export function savedCodeCheck(d: Draft | null): DraftCodeCheck | null {
  if (!d?.discountCode || !d.discountId) return null
  return {
    ok: true,
    discountId: d.discountId,
    code: d.discountCode,
    label: d.discountLabel ?? d.discountCode,
    amountPaise: d.discountPaise,
    freeShipping: false,
    shippingPaise: d.shippingPaise,
  }
}

/** The shipping state a code is checked against: only a complete address has one, as on save. */
export const draftStateCode = (f: DraftFormState): string | null =>
  addressPayload(f.address, f.phone)?.stateCode ?? null

export const draftSubtotal = (lines: DraftLine[]): number =>
  lines.reduce((sum, l) => sum + l.quantity * l.unitPricePaise, 0)

/**
 * The bill as the server will save it: an applied code's amount (and waived shipping), else
 * the manual discount. A code still being checked, or refused, takes nothing off yet.
 */
export function draftTotals(f: DraftFormState, check: DraftCodeCheck | null = null) {
  const subtotalPaise = draftSubtotal(f.lines)
  const coded = f.discountCode && check?.ok ? check : null
  const discountPaise = f.discountCode
    ? (coded?.amountPaise ?? 0)
    : Math.min(f.discountPaise, subtotalPaise)
  const shippingPaise = coded ? coded.shippingPaise : f.shippingPaise
  return {
    subtotalPaise,
    discountPaise,
    shippingPaise,
    totalPaise: subtotalPaise - discountPaise + shippingPaise,
  }
}

/** HSN codes are 4, 6 or 8 digits (as Settings → Taxes checks them). */
const HSN = /^[0-9]{4}([0-9]{2}){0,2}$/

export type CustomItemFields = {
  title: string
  /** As typed, in rupees. */
  price: string
  quantity: string
  taxable: boolean
  hsCode: string
}

export type CustomItemError = 'title' | 'price' | 'quantity' | 'hsCode'

/** What is wrong with a custom item as typed; empty when it can be added. */
export function customItemErrors(
  f: CustomItemFields,
  parsePrice: (text: string) => number | null,
): CustomItemError[] {
  const errors: CustomItemError[] = []
  if (!f.title.trim() || f.title.trim().length > 200) errors.push('title')
  const price = parsePrice(f.price)
  if (price === null || price < 0) errors.push('price')
  const qty = Number(f.quantity)
  if (!Number.isInteger(qty) || qty < 1 || qty > 999) errors.push('quantity')
  if (f.hsCode.trim() && !HSN.test(f.hsCode.trim())) errors.push('hsCode')
  return errors
}

/** A valid custom item as a draft line; `key` keeps it apart from other custom lines. */
export function customItemLine(f: CustomItemFields, pricePaise: number, key: string): DraftLine {
  return {
    key,
    variantId: '',
    title: f.title.trim(),
    variantTitle: '',
    sku: null,
    quantity: Number(f.quantity),
    unitPricePaise: pricePaise,
    giftCard: false,
    custom: { taxable: f.taxable, hsCode: f.hsCode.trim() },
  }
}

/**
 * The draft's addresses from the customer's book: shipping from their default shipping address,
 * billing from their default billing one (else it follows shipping). A billing default that is
 * another address, or carries a company or GSTIN, fills the billing card. A guest who checked out
 * without saving an address book still has the address of their last order
 * (`customer.default_address`), which fills shipping; nothing saved, nothing changes.
 */
export function addressesFrom(found: Found): Partial<DraftFormState> {
  const book: readonly SavedAddress[] = found.addresses
  const ship = book.find((a) => a.isDefault) ?? book[0]
  if (!ship) {
    const last = found.defaultAddress
    if (!last?.line1) return {}
    return {
      address: addressToForm({ ...last, line2: last.line2 ?? null, phone: last.phone ?? '' }),
    }
  }
  const bill = book.find((a) => a.isDefaultBilling) ?? ship
  const separate = bill.id !== ship.id || Boolean(bill.gstin || bill.businessName)
  return {
    address: addressToForm(ship),
    billingSameAsShipping: !separate,
    billing: separate
      ? { ...addressToForm(bill), businessName: bill.businessName ?? '', gstin: bill.gstin ?? '' }
      : { ...EMPTY_BILLING },
  }
}

/** A new draft for this customer ("Create order" on their page): contact and addresses filled in. */
export const draftForCustomer = (found: Found): DraftFormState => ({
  ...emptyDraft(),
  customerId: found.id,
  customerName: found.name ?? '',
  email: found.email ?? '',
  phone: found.phone ?? '',
  ...addressesFrom(found),
})
