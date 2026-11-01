import type { CartView, CheckoutLook, SavedAddress, SignedInCustomer } from '@commerce/core'
import type { CheckoutSettings, CheckoutTextOverrides } from '@commerce/core/checkout-settings'
import type {
  CheckoutAccountMode,
  LoginMethod,
  SignInOptions,
} from '@commerce/core/customer-accounts'
import type { PaymentMethodRule } from '@commerce/core/payment-method-rules'
import type { PolicyLink } from '@commerce/core/policies'
import type { CheckoutFieldKey } from '@/lib/checkout-validation'
import type { CartDiscountView } from '@/lib/discount-view'
import type { CheckoutMethod } from '@/lib/payments'
import type { CartDepositTerms } from '@/lib/preorder'

/** Settings → Customer accounts, as the Contact card needs it. */
export type CheckoutSignIn = {
  /** Code methods the store can send, in order; never empty. */
  methods: LoginMethod[]
  /** `account_required`: the shopper signs in before anything else. */
  checkout: CheckoutAccountMode
  /** Providers, passkeys and the rest the store switched on. */
  options: SignInOptions | null
}

export type CheckoutFormInput = {
  cart: CartView
  methods: CheckoutMethod[]
  /** Discount in force for this cart, resolved on the server. */
  discount: CartDiscountView | null
  /** The signed-in shopper, or null for guest checkout. */
  customer?: SignedInCustomer | null
  /** Their saved addresses, default first. */
  addresses?: SavedAddress[]
  /** Deposit pre-orders: the balance left for later and the store's deposit terms. */
  deposit?: CartDepositTerms
  /** Settings → Checkout; the server re-checks every rule on submit. */
  settings: CheckoutSettings
  /** Published store policies, linked above the button. */
  policies?: PolicyLink[]
  /** Settings → Checkout → Branding, the store name and logo. */
  look: CheckoutLook
  /** The smallest amount the store offers EMI on; null when it offers none. */
  emiMinPaise?: number | null
  /** How shoppers sign in here, and whether a guest may check out. */
  signIn?: CheckoutSignIn
  /** Settings → Checkout → Checkout content (#158): the store's wording in this language. */
  text?: CheckoutTextOverrides
  /** Settings → Payments → Payment rules (#150): ways to pay hidden for some orders. */
  methodRules?: PaymentMethodRule[]
  /** The Country picker: India, then the countries the store's shipping zones cover. */
  countries?: string[]
  /** The country a new address opens in: the shopper's market country when offered. */
  defaultCountry?: string
}

export type ChangeHandler = (
  e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
) => void

export const NO_DEPOSIT: CartDepositTerms = { laterPaise: 0, nonRefundableDays: null }
export const INDIA_ONLY = ['IN']
/** The fields a new country empties, so their checks start over. */
export const PLACE_KEYS: readonly string[] = ['pincode', 'stateCode', 'city']
export const GUEST_EMAIL: CheckoutSignIn = { methods: ['email'], checkout: 'guest', options: null }
/** The Send code button in Contact; Pay points here until the shopper signs in. */
export const SEND_CODE_ID = 'checkout-send-code'
/** The Save button of an address being edited. */
export const SAVE_ADDRESS_ID = 'checkout-address-save'

/** What an address book entry needs before Save writes it. */
export const ADDRESS_KEYS = [
  'pincode',
  'name',
  'lastName',
  'line1',
  'line2',
  'city',
  'stateCode',
  'phone',
] as const
/** The fields the Contact card shows; every other field is the Delivery card's. */
export const CONTACT_KEYS: readonly CheckoutFieldKey[] = ['email', 'phone']
