import type { CartView, CheckoutLook, SavedAddress, SignedInCustomer } from '@commerce/core'
import { defaultCheckoutSettings } from '@commerce/core/checkout-settings'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

let search = ''
vi.mock('next/navigation', () => ({
  usePathname: () => '/checkout',
  useRouter: () => ({ refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}))
vi.mock('@/lib/cart-actions', () => ({ captureContactAction: vi.fn(), checkoutAction: vi.fn() }))
vi.mock('@/lib/shipping-actions', () => ({ checkoutShippingAction: vi.fn() }))
vi.mock('@/lib/discount-actions', () => ({
  applyDiscountAction: vi.fn(),
  removeDiscountAction: vi.fn(),
}))
vi.mock('@/lib/gift-card-actions', () => ({ checkGiftCardAction: vi.fn() }))
vi.mock('@/lib/pincode-actions', () => ({ lookupPincodeAction: vi.fn() }))
vi.mock('@/lib/account-actions', () => ({
  requestCodeAction: vi.fn(),
  verifyCodeAction: vi.fn(),
  saveAddressAction: vi.fn(),
  deleteAddressAction: vi.fn(),
}))
vi.mock('@/lib/privacy-actions', () => ({
  requestPhoneCodeAction: vi.fn(),
  verifyPhoneCodeAction: vi.fn(),
}))
vi.mock('@/lib/login-actions', () => ({}))
// The courier never answers in a static render; a test can stand in for its answer.
let courier: 'ok' | null = null
vi.mock('@/lib/use-checkout-shipping', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/use-checkout-shipping')>()
  return {
    ...actual,
    useCheckoutShipping: (...args: Parameters<typeof actual.useCheckoutShipping>) => {
      const quote = actual.useCheckoutShipping(...args)
      return courier ? { ...quote, gate: courier } : quote
    },
  }
})

const { default: CheckoutForm } = await import('./checkout-form')

const cart: CartView = {
  id: 'c',
  status: 'open',
  itemCount: 1,
  subtotalPaise: 749_900,
  discountCode: null,
  lines: [
    {
      id: 'l1',
      variantId: 'v1',
      productHandle: 'mouse',
      productTitle: 'Wireless mouse',
      variantTitle: 'Black',
      quantity: 1,
      unitPricePaise: 749_900,
      linePaise: 749_900,
      available: 10,
      imageUrl: null,
      giftCard: false,
      preorder: false,
    },
  ],
}
const look: CheckoutLook = {
  branding: defaultCheckoutSettings.branding,
  storeName: 'Waimers',
  logoUrl: null,
  contactPhone: null,
}

const props = {
  cart,
  methods: [
    { id: 'cod', label: 'Cash on delivery' },
    { id: 'decentro', label: 'UPI (Decentro)' },
  ],
  discount: null,
  settings: { ...defaultCheckoutSettings, gstin: true, orderNotes: true },
  look,
}
const customer = {
  id: 'cus_1',
  email: 'asha@example.com',
  phone: '+919876543210',
  name: 'Asha Verma',
} as SignedInCustomer
const address = {
  id: 'adr_1',
  name: 'Asha Verma',
  phone: '+919876543210',
  line1: '14 Rajpath Colony',
  line2: null,
  city: 'Jaipur',
  stateCode: 'RJ',
  pincode: '302001',
  label: 'home',
  isDefault: true,
} as SavedAddress
const office = {
  ...address,
  id: 'adr_2',
  line1: 'Plot 22, Sitapura Industrial Area',
  pincode: '302022',
  label: 'office',
  isDefault: false,
} as SavedAddress
const signIn = {
  methods: ['whatsapp', 'sms', 'email'],
  checkout: 'guest',
  options: null,
} as const

const render = (at: string, extra: object = {}) => {
  search = at
  return renderToStaticMarkup(createElement(CheckoutForm, { ...props, ...extra }))
}
const html = render('')

describe('CheckoutForm', () => {
  // Hydration fix #224: the summary's code fields sit beside the checkout <form>, and a nested
  // <form> is invalid HTML the browser drops, which breaks hydration.
  it('renders exactly one form', () => {
    expect(html.match(/<form/g)).toHaveLength(1)
  })

  it('opens on Contact with a phone code first for a guest', () => {
    expect(html).toContain('Sign in or create your account')
    expect(html).toContain('aria-current="step"')
    expect(html).toContain('id="checkout-send-code"')
    expect(html).toContain('Send code')
    expect(html).toContain('Check out as guest')
    expect(html).toContain('Continue')
    // The address and express pay wait until the shopper is known.
    expect(html).not.toContain('checkout-pincode')
    expect(html).not.toContain('Pay with UPI')
    expect(html).not.toContain('value="cod"')
  })

  it('offers the store methods, and no guest way when an account is required', () => {
    const guest = render('', { signIn })
    expect(guest).toContain('WhatsApp')
    expect(guest).toContain('Use your email instead')
    const required = render('', { signIn: { ...signIn, checkout: 'account_required' } })
    expect(required).not.toContain('Check out as guest')
    expect(required).toContain('This shop needs an account to check out.')
  })

  it('takes a signed-in shopper straight to Address, their saved addresses as tagged cards', () => {
    const page = render('', { customer, addresses: [address, office], signIn })
    expect(page).toContain('Where should we deliver?')
    expect(page).toContain('Change contact details')
    expect(page).toContain('Home')
    expect(page).toContain('Office')
    expect(page.match(/name="saved-address"/g)).toHaveLength(2)
    expect(page).toContain('Edit the address for Asha Verma')
    expect(page).toContain('Delete the address for Asha Verma')
    expect(page).toContain('Add new address')
    // Express UPI waits for the courier's price too, not only a known shopper and address.
    expect(page).not.toContain('Pay with UPI')
    expect(page).not.toContain('id="checkout-send-code"')
    // The picked card's details are the form's; the PIN-first form is not open.
    expect(page).not.toContain('for="checkout-pincode"')
  })

  it('offers express UPI once the contact, the address and the shipping price are all known', () => {
    courier = 'ok'
    try {
      expect(render('', { customer, addresses: [address], signIn })).toContain('Pay with UPI')
      // A signed-in shopper still typing a new address gets no shortcut yet.
      expect(render('', { customer, addresses: [], signIn })).not.toContain('Pay with UPI')
    } finally {
      courier = null
    }
  })

  it('opens the PIN-first form for a signed-in shopper with no saved address', () => {
    const page = render('', { customer, addresses: [], signIn })
    expect(page.indexOf('for="checkout-pincode"')).toBeLessThan(page.indexOf('for="checkout-name"'))
    expect(page).toContain('Save this address as')
  })

  it('keeps a guest who asks for a later step on Contact', () => {
    expect(render('?step=payment')).toContain('Sign in or create your account')
  })

  it('shows a signed-in shopper their details on Contact when they go back to it', () => {
    expect(render('?step=contact', { customer, addresses: [address], signIn })).toContain(
      'Signed in as asha@example.com',
    )
  })

  it('pays the exact amount on the payment step, UPI first, with the recap above', () => {
    const pay = render('?step=payment', { customer, addresses: [address] })
    expect(pay).toContain('How would you like to pay?')
    expect(pay).toContain('Pay ₹7,499')
    expect(pay.indexOf('value="decentro"')).toBeLessThan(pay.indexOf('value="cod"'))
    expect(pay).toContain('Asha Verma, 14 Rajpath Colony, Jaipur 302001')
    expect(pay).toContain('Change address')
    expect(pay.match(/<form/g)).toHaveLength(1)
  })

  it('names the gateways that process the payment under Pay, and only there', () => {
    const methods = [...props.methods, { id: 'razorpay', label: 'Razorpay', methods: ['upi'] }]
    const pay = render('?step=payment', { customer, addresses: [address], methods })
    expect(pay).toContain('Payments processed by Razorpay')
    expect(pay.indexOf('value="decentro"')).toBeLessThan(pay.indexOf('value="razorpay"'))
    expect(pay.indexOf('value="razorpay"')).toBeLessThan(pay.indexOf('value="cod"'))
    const ship = render('?step=shipping', { customer, addresses: [address], methods })
    expect(ship).not.toContain('Payments processed by')
  })

  it('shows the order summary on every step', () => {
    for (const at of ['', '?step=shipping', '?step=payment']) {
      const page = render(at, { customer, addresses: [address] })
      expect(page).toContain('Wireless mouse')
      expect(page).toContain('Order summary')
    }
  })

  it('labels every field and leaves validation to the inline checks', () => {
    const shopper = { customer: { ...customer, email: null }, addresses: [] }
    const contact = render('?step=contact', shopper)
    const address = render('?step=address', { customer, addresses: [] })
    expect(contact).toMatch(/novalidate/i)
    for (const id of ['checkout-email', 'checkout-phone']) expect(contact).toContain(`for="${id}"`)
    for (const id of ['checkout-pincode', 'checkout-name']) expect(address).toContain(`for="${id}"`)
    expect(address.match(/<form/g)).toHaveLength(1)
  })

  it('carries the branding as --ck-* properties, not the theme', () => {
    expect(html).toContain('--ck-accent:#171717')
    expect(html).toContain('class="ck ')
  })
})
