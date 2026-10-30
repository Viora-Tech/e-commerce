import { describe, expect, it } from 'vitest'
import { PRODUCT_APP_ACTIONS, type ProductApp, productActionsFor } from './product-actions'

const reviews: ProductApp = { id: 'reviews', name: 'Reviews', icon: 'Star' }
const gst: ProductApp = { id: 'gst-invoices', name: 'GST invoices', icon: 'FileText' }
const chatwoot: ProductApp = { id: 'chatwoot', name: 'Chatwoot', icon: 'MessageSquare' }

describe('productActionsFor', () => {
  it('keeps installed apps that add product actions, in their order', () => {
    const groups = productActionsFor([gst, chatwoot, reviews])
    expect(groups.map((g) => g.app.id)).toEqual(['gst-invoices', 'reviews'])
  })

  it('adds nothing without apps', () => {
    expect(productActionsFor([])).toEqual([])
  })
})

describe('PRODUCT_APP_ACTIONS', () => {
  it('filters the Reviews list to the product', () => {
    const target = PRODUCT_APP_ACTIONS.reviews?.[0]?.target
    expect(target?.kind === 'link' && target.href('abc')).toBe('/apps/reviews?product=abc')
  })

  it('sends GST to the HSN field on the Shipping tab', () => {
    expect(PRODUCT_APP_ACTIONS['gst-invoices']?.[0]?.target).toEqual({
      kind: 'tab',
      tab: 'shipping',
      focus: 'product-hs',
    })
  })
})
