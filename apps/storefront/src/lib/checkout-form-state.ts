import type { SavedAddress, SignedInCustomer } from '@commerce/core'
import type { CheckoutForm } from '@/lib/cart-actions'

/** Everything the checkout form holds; the action's fields plus the optional extras. */
export type CheckoutFormState = CheckoutForm & {
  gstin: string
  businessName: string
  note: string
  /** The address's tag (`ADDRESS_LABELS`), or '' for none. */
  label: string
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
): Omit<CheckoutFormState, 'payment'> {
  return {
    ...EMPTY_FORM,
    name: address?.name ?? customer?.name ?? '',
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
