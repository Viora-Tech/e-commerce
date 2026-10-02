import type { CartView } from '@commerce/core'
import { defaultCheckoutSettings } from '@commerce/core/checkout-settings'
import { describe, expect, it } from 'vitest'
import {
  checkoutTotals,
  methodView,
  offeredMethods,
  takesUpi,
  trustMethodNames,
} from './checkout-preview'

const line = (over: Partial<CartView['lines'][number]> = {}): CartView['lines'][number] => ({
  id: 'l1',
  variantId: 'v1',
  productHandle: 'mouse',
  productTitle: 'Mouse',
  variantTitle: 'Black',
  quantity: 1,
  unitPricePaise: 499_900,
  linePaise: 499_900,
  available: 10,
  imageUrl: null,
  giftCard: false,
  preorder: false,
  ...over,
})
const cart = (lines = [line()]): CartView => ({
  id: 'c',
  status: 'open',
  lines,
  itemCount: lines.length,
  subtotalPaise: lines.reduce((s, l) => s + l.linePaise, 0),
  discountCode: null,
})

const cod = { id: 'cod', label: 'Cash on delivery' }
const decentro = { id: 'decentro', label: 'UPI (Decentro)' }
const razorpay = { id: 'razorpay', label: 'Razorpay', methods: ['card', 'upi'] as const }
const manual = { id: 'manual', label: 'UPI or bank transfer to the shop' }

describe('offeredMethods', () => {
  it('puts UPI first and cash on delivery last, whatever the saved order', () => {
    const ids = offeredMethods(cart(), [
      cod,
      manual,
      { ...razorpay, methods: [...razorpay.methods] },
      decentro,
    ]).map((m) => m.id)
    expect(ids).toEqual(['decentro', 'razorpay', 'manual', 'cod'])
  })

  it('never offers cash on delivery for a basket of gift cards', () => {
    const ids = offeredMethods(cart([line({ giftCard: true })]), [decentro, cod]).map((m) => m.id)
    expect(ids).toEqual(['decentro'])
  })
})

describe('method names', () => {
  it('shows ways to pay, never a gateway brand', () => {
    expect(methodView(decentro).title).toBe('UPI')
    expect(methodView({ ...razorpay, methods: [...razorpay.methods] }).title).toBe(
      'UPI, cards and more',
    )
    expect(takesUpi({ id: 'cashfree', label: 'Cashfree', methods: ['card'] })).toBe(false)
    expect(trustMethodNames([decentro, cod])).toEqual(['UPI', 'Cash on delivery'])
  })
})

describe('checkoutTotals', () => {
  const base = {
    cart: cart(),
    methods: [decentro, cod],
    settings: defaultCheckoutSettings,
    discountPaise: 0,
    shipping: null,
    rate: undefined,
    giftCards: [],
    picked: 'decentro',
    pincode: '110001',
    laterPaise: 0,
  }

  it('charges the goods when nothing else applies', () => {
    const t = checkoutTotals(base)
    expect(t.totalPaise).toBe(499_900)
    expect(t.payNowPaise).toBe(499_900)
    expect(t.codBlocked).toBe(false)
  })

  it('takes a pre-order balance off what is paid today', () => {
    expect(checkoutTotals({ ...base, laterPaise: 300_000 }).payNowPaise).toBe(199_900)
  })

  it('moves a blocked cash on delivery pick to the first online way to pay', () => {
    const settings = {
      ...defaultCheckoutSettings,
      cod: { ...defaultCheckoutSettings.cod, maxOrderPaise: 100_000 },
    }
    const t = checkoutTotals({ ...base, settings, picked: 'cod' })
    expect(t.codBlocked).toBe(true)
    expect(t.payment).toBe('decentro')
    expect(t.codNote).toContain('₹1,000')
  })

  it('treats an order covered by gift cards as paid', () => {
    const t = checkoutTotals({
      ...base,
      giftCards: [{ code: 'G', lastCharacters: 'ABCD', balancePaise: 600_000 }],
    })
    expect(t.coveredByCards).toBe(true)
    expect(t.payNowPaise).toBe(0)
  })
})
