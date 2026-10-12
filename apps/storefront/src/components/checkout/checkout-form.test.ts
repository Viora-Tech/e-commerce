import type { CartView, CheckoutLook, SavedAddress, SignedInCustomer } from '@commerce/core'
import { defaultCheckoutSettings } from '@commerce/core/checkout-settings'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

let search = ''
vi.mock('next/navigation', () => ({
  usePathname: () => '/checkout',
  useRouter: () => ({}),
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
} as SavedAddress

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

  it('opens on Address with contact first and express UPI at the top', () => {
    expect(html).toContain('Where should we deliver?')
    expect(html).toContain('aria-current="step"')
    expect(html.indexOf('Pay with UPI')).toBeLessThan(html.indexOf('checkout-contact-title'))
    expect(html.indexOf('checkout-email')).toBeLessThan(html.indexOf('checkout-pincode'))
    expect(html).toContain('Continue to shipping')
    expect(html).not.toContain('value="cod"')
  })

  it('keeps a guest who asks for a later step on Address', () => {
    expect(render('?step=payment')).toContain('Where should we deliver?')
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

  it('shows the order summary on every step', () => {
    for (const at of ['', '?step=shipping', '?step=payment']) {
      const page = render(at, { customer, addresses: [address] })
      expect(page).toContain('Wireless mouse')
      expect(page).toContain('Order summary')
    }
  })

  it('labels every field and leaves validation to the inline checks', () => {
    expect(html).toMatch(/novalidate/i)
    for (const id of ['checkout-email', 'checkout-phone', 'checkout-pincode', 'checkout-name']) {
      expect(html).toContain(`for="${id}"`)
    }
  })

  it('carries the branding as --ck-* properties, not the theme', () => {
    expect(html).toContain('--ck-accent:#2F5BEA')
    expect(html).toContain('class="ck ')
  })
})
