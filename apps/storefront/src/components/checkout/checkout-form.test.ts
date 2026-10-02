import type { CartView, CheckoutLook } from '@commerce/core'
import { defaultCheckoutSettings } from '@commerce/core/checkout-settings'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ usePathname: () => '/checkout', useRouter: () => ({}) }))
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

const html = renderToStaticMarkup(
  createElement(CheckoutForm, {
    cart,
    methods: [
      { id: 'cod', label: 'Cash on delivery' },
      { id: 'decentro', label: 'UPI (Decentro)' },
    ],
    discount: null,
    settings: { ...defaultCheckoutSettings, gstin: true, orderNotes: true },
    look,
  }),
)

describe('CheckoutForm', () => {
  // Hydration fix #224: the summary's code fields sit beside the checkout <form>, and a nested
  // <form> is invalid HTML the browser drops, which breaks hydration.
  it('renders exactly one form', () => {
    expect(html.match(/<form/g)).toHaveLength(1)
  })

  it('pays the exact amount, UPI first, express at the top', () => {
    expect(html).toContain('Pay ₹7,499')
    expect(html.indexOf('Pay with UPI')).toBeLessThan(html.indexOf('Contact'))
    expect(html.indexOf('value="decentro"')).toBeLessThan(html.indexOf('value="cod"'))
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
