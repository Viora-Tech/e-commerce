import { createElement, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { offeredMethods } from '@/lib/checkout-preview'
import type { CheckoutMethod } from '@/lib/payments'
import PaymentMethods from './payment-methods'

const cart = {
  id: 'c',
  status: 'open',
  itemCount: 1,
  subtotalPaise: 100_000,
  discountCode: null,
  lines: [
    {
      id: 'l1',
      variantId: 'v1',
      productHandle: 'mouse',
      productTitle: 'Mouse',
      variantTitle: 'Black',
      quantity: 1,
      unitPricePaise: 100_000,
      linePaise: 100_000,
      available: 10,
      imageUrl: null,
      giftCard: false,
      preorder: false,
    },
  ],
} as const
const methods: CheckoutMethod[] = offeredMethods(cart as never, [
  { id: 'cod', label: 'Cash on delivery' },
  { id: 'cashfree', label: 'Cashfree', methods: ['card', 'netbanking'] },
  { id: 'razorpay', label: 'Razorpay', methods: ['upi', 'card', 'netbanking', 'emi'] },
])
const props = { methods, selected: 'razorpay', codBlocked: false, codNote: null, onSelect: vi.fn() }
const render = (over: object = {}) =>
  renderToStaticMarkup(createElement(PaymentMethods, { ...props, ...over }))

/** Every radio in the list, from the element tree (no DOM needed). */
function radios(node: ReactNode): { value: string; onChange: () => void }[] {
  if (Array.isArray(node)) return node.flatMap(radios)
  if (!isValidElement(node)) return []
  const p = node.props as {
    type?: string
    value?: string
    onChange?: () => void
    children?: ReactNode
  }
  if (node.type === 'input' && p.type === 'radio')
    return [{ value: p.value ?? '', onChange: p.onChange ?? (() => {}) }]
  return radios(p.children)
}

describe('PaymentMethods', () => {
  it('lists UPI first and cash on delivery last, gateways titled by their brand', () => {
    const html = render()
    const at = (id: string) => html.indexOf(`value="${id}"`)
    expect(at('razorpay')).toBeLessThan(at('cashfree'))
    expect(at('cashfree')).toBeLessThan(at('cod'))
    expect(html).toContain('>Razorpay<')
    expect(html).toContain('UPI · Cards · Netbanking · EMI and pay later')
    expect(html).toContain('>Cashfree<')
    expect(html).toContain('Cash on delivery')
  })

  it('opens the picked method only, and switches with the pick', () => {
    const upi = render()
    expect(upi).toContain('Pay with any UPI app')
    expect(upi).toContain('Processed by Razorpay')
    expect(upi.match(/checked=""/g)).toHaveLength(1)

    const cards = render({ selected: 'cashfree' })
    expect(cards).not.toContain('Pay with any UPI app')
    expect(cards).toContain('secure window. Processed by Cashfree.')

    const cash = render({ selected: 'cod' })
    expect(cash).not.toContain('Pay with any UPI app')
    expect(cash).not.toContain('Processed by')
  })

  it('reports the pick for each method', () => {
    const onSelect = vi.fn()
    const list = radios(PaymentMethods({ ...props, onSelect }))
    expect(list.map((r) => r.value)).toEqual(['razorpay', 'cashfree', 'cod'])
    list[2]?.onChange()
    list[1]?.onChange()
    expect(onSelect.mock.calls).toEqual([['cod'], ['cashfree']])
  })

  it('asks for no UPI ID (UPI Collect is gone): QR or the app only', () => {
    const html = render()
    expect(html).not.toMatch(/UPI ID|@bank|yourname/i)
    for (const app of ['GPay', 'PhonePe', 'Paytm', 'BHIM']) expect(html).toContain(app)
  })

  it('keeps blocked cash on delivery visible, disabled, with the reason', () => {
    const html = render({ codBlocked: true, codNote: 'Not available for this PIN code' })
    expect(html.match(/<input[^>]*value="cod"[^>]*>/)?.[0]).toContain('disabled=""')
    expect(html).toContain('Not available for this PIN code')
  })
})
