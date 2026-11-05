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
const { default: CheckoutForm } = await import('./checkout-form')
const { default: CheckoutPayNote } = await import('./checkout-pay-note')

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

  it('keeps every step in the one form, in order, with only the first on screen', () => {
    const at = (text: string) => html.indexOf(text)
    for (const id of ['contact', 'address', 'shipping', 'payment']) {
      expect(html).toContain(`id="checkout-section-${id}"`)
    }
    // Express checkout is off for now (checkout-form.tsx).
    expect(at('Express checkout')).toBe(-1)
    expect(at('id="checkout-section-contact"')).toBeLessThan(at('id="checkout-section-address"'))
    expect(at('id="checkout-section-address"')).toBeLessThan(at('id="checkout-section-shipping"'))
    expect(at('id="checkout-section-shipping"')).toBeLessThan(at('id="checkout-section-payment"'))
    expect(html.match(/aria-current="step"/g)).toHaveLength(1)
    expect(html).toMatch(/id="checkout-section-contact"[^>]*class="flex /)
    expect(html).toMatch(/id="checkout-section-payment"[^>]*class="hidden /)
    expect(html).toContain('Continue')
  })

  it('holds Pay until the last step', () => {
    expect(html).toContain('Complete all steps to pay')
    expect(html).toMatch(
      /form="checkout-form"[^>]*disabled=""|disabled=""[^>]*form="checkout-form"/,
    )
  })

  it('gives a guest the plain contact fields, with Sign in in the card heading', () => {
    expect(html).toContain('for="checkout-phone"')
    expect(html).toContain('for="checkout-email"')
    expect(html).toContain('>Sign in</button>')
    expect(html).not.toContain('id="checkout-send-code"')
    // The PIN code comes first in Delivery, City and State after it.
    expect(html.indexOf('for="checkout-pincode"')).toBeLessThan(html.indexOf('for="checkout-name"'))
    expect(html.indexOf('for="checkout-name"')).toBeLessThan(html.indexOf('for="checkout-city"'))
  })

  it('asks for the code first when the store needs an account, with its methods', () => {
    const required = render('', { signIn: { ...signIn, checkout: 'account_required' } })
    expect(required).toContain('id="checkout-send-code"')
    expect(required).toContain('WhatsApp')
    expect(required).toContain('This shop needs an account to check out.')
    expect(required).not.toContain('Check out as guest')
    expect(required).not.toContain('>Sign in</button>')
  })

  it('shows a signed-in shopper their details and saved addresses as tagged cards', () => {
    const page = render('', { customer, addresses: [address, office], signIn })
    expect(page).toContain('Signed in as asha@example.com')
    expect(page).toContain('Home')
    expect(page).toContain('Office')
    expect(page.match(/name="saved-address"/g)).toHaveLength(2)
    expect(page).toContain('Edit the address for Asha Verma')
    expect(page).toContain('Delete the address for Asha Verma')
    expect(page).toContain('Add new address')
    expect(page).not.toContain('id="checkout-send-code"')
    expect(page).not.toContain('for="checkout-pincode"')
  })

  it('opens the PIN-first form for a signed-in shopper with no saved address', () => {
    const page = render('', { customer, addresses: [], signIn })
    expect(page.indexOf('for="checkout-pincode"')).toBeLessThan(page.indexOf('for="checkout-name"'))
    expect(page).toContain('Save this address as')
  })

  // Express checkout is off for now: bring this back with it (checkout-form.tsx).
  it.skip('puts express UPI in its own card, waiting for the shipping option it will charge', () => {
    expect(html).toContain('aria-label="Pay with Google Pay"')
    expect(html).toContain('aria-label="Pay with PhonePe"')
    expect(html).toContain('aria-label="Pay with Paytm"')
    // No PIN code quoted yet: no shipping price, so the line says what is missing.
    expect(html).toContain('Add your PIN code below to see shipping')
    // Not inside Delivery any more.
    expect(html.indexOf('Pay with Google Pay')).toBeLessThan(
      html.indexOf('checkout-section-address'),
    )
  })

  it('leaves express out when no way to pay takes UPI', () => {
    const page = render('', { methods: [{ id: 'cod', label: 'Cash on delivery' }] })
    expect(page).not.toContain('Express checkout')
  })

  it('opens the one form for ?step= links, whatever they say', () => {
    for (const at of [
      '?step=payment',
      '?step=shipping',
      '?step=contact',
      '?step=bogus',
      '?step=',
    ]) {
      const page = render(at, { customer, addresses: [address] })
      expect(page.match(/<form/g)).toHaveLength(1)
      expect(page).toContain('id="checkout-section-contact"')
      expect(page).toContain('id="checkout-section-payment"')
    }
    expect(render('?step=payment').match(/<form/g)).toHaveLength(1)
  })

  it('pays the exact amount, UPI first, from the summary and the phone bar', () => {
    const pay = render('', { customer, addresses: [address] })
    expect(pay.match(/Pay ₹7,499/g)?.length).toBeGreaterThanOrEqual(2)
    expect(
      pay.match(/type="submit"[^>]*form="checkout-form"|form="checkout-form"[^>]*type="submit"/g),
    ).toHaveLength(3)
    expect(pay.indexOf('value="decentro"')).toBeLessThan(pay.indexOf('value="cod"'))
  })

  it('lists the gateways in the Payment step', () => {
    const methods = [...props.methods, { id: 'razorpay', label: 'Razorpay', methods: ['upi'] }]
    const pay = render('', { customer, addresses: [address], methods })
    expect(pay.indexOf('value="decentro"')).toBeLessThan(pay.indexOf('value="razorpay"'))
    expect(pay.indexOf('value="razorpay"')).toBeLessThan(pay.indexOf('value="cod"'))
  })

  it('keeps the GST invoice box in the Payment card', () => {
    expect(html.indexOf('Get a GST invoice for my business')).toBeGreaterThan(
      html.indexOf('id="checkout-section-payment"'),
    )
  })

  it('shows the order summary', () => {
    const page = render('', { customer, addresses: [address] })
    expect(page).toContain('Wireless mouse')
    expect(page).toContain('Order summary')
  })

  it('labels every field and leaves validation to the inline checks', () => {
    expect(html).toMatch(/novalidate/i)
    for (const id of ['checkout-email', 'checkout-phone', 'checkout-pincode', 'checkout-name']) {
      expect(html).toContain(`for="${id}"`)
    }
  })

  it('carries the branding as --ck-* properties, not the theme', () => {
    expect(html).toContain('--ck-accent:#171717')
    expect(html).toContain('class="ck ')
  })
})

describe('CheckoutPayNote', () => {
  it('names the gateways that process the payment', () => {
    const note = renderToStaticMarkup(createElement(CheckoutPayNote, { names: ['Razorpay'] }))
    expect(note).toMatch(/Secured by.*Razorpay/)
  })
})
