import type { SavedAddress, SignedInCustomer } from '@commerce/core'
import { type NameFormat, splitName } from '@commerce/core/checkout-settings'
import type { CheckoutForm } from '@/lib/cart-actions'

/** Everything the checkout form holds; the action's fields plus the optional extras. */
export type CheckoutFormState = CheckoutForm & {
  gstin: string
  businessName: string
  note: string
  /** The address's tag (`ADDRESS_LABELS`), or '' for none. */
  label: string
  /**
   * Settings → Checkout splits the name (#154): `name` then holds the first name and this the
   * last. Unset (and unused) for one full name.
   */
  lastName?: string
}

const EMPTY_FORM: Omit<CheckoutFormState, 'payment'> = {
  name: '',
  email: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  stateCode: 'HR',
  pincode: '',
  gstin: '',
  businessName: '',
  note: '',
  label: '',
}

/** The address book's "Use a new address" choice. */
export const NEW_ADDRESS = 'new'

/** Contact and address fields from the account, so a returning shopper types nothing. */
export function prefillCheckout(
  customer: SignedInCustomer | null,
  address: SavedAddress | undefined,
  nameFormat: NameFormat = 'full',
): Omit<CheckoutFormState, 'payment'> {
  const fullName = address?.name ?? customer?.name ?? ''
  const parts = nameFormat === 'split' ? splitName(fullName) : null
  return {
    ...EMPTY_FORM,
    name: parts ? parts.first : fullName,
    ...(parts ? { lastName: parts.last } : {}),
    email: customer?.email ?? '',
    phone: address?.phone ?? customer?.phone ?? '',
    ...(address
      ? {
          line1: address.line1,
          line2: address.line2 ?? '',
          city: address.city,
          stateCode: address.stateCode,
          pincode: address.pincode,
          label: address.label ?? '',
        }
      : {}),
  }
}

/** The order's full name: the first and last name joined when the store splits it. */
export function fullNameOf(form: Pick<CheckoutFormState, 'name' | 'lastName'>): string {
  return [form.name.trim(), (form.lastName ?? '').trim()].filter(Boolean).join(' ')
}
