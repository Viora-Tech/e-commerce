import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ProductBuyButtons from '../src/components/product-buy-buttons'
import type { ProductDetail } from '../src/types'

type Variant = ProductDetail['variants'][number]

const variant = (available: number): Variant => ({
  id: 'v1',
  title: 'Black',
  sku: null,
  pricePaise: 1_000_000,
  mrpPaise: null,
  available,
  purchasable: true,
  optionValueIds: [],
  imageUrl: null,
})

const product = (v: Variant): ProductDetail => ({
  id: 'p1',
  handle: 'viper',
  title: 'Viper V3',
  description: '',
  vendor: null,
  productType: null,
  images: [],
  options: [],
  variants: [v],
})

const availability = (v: Variant, isPreorder = false) => {
  const out = renderToStaticMarkup(
    createElement(ProductBuyButtons, {
      product: product(v),
      variant: v,
      countdown: 0,
      isPreorder,
      onAddToCart: async () => undefined,
      stockBarShown: false,
      preorderLink: null,
    }),
  )
  return out.match(/<p class="(buy-buttons__availability[^"]*)"[^>]*>([^<]*)</)?.slice(1)
}

// The live review (29 Oct) found "Available for pre-order" and "In stock" drawn in the error red.
describe('the availability line under the buy buttons', () => {
  it('is a plain status line for stock and pre-orders', () => {
    expect(availability(variant(40))).toEqual([
      'buy-buttons__availability text-small',
      'In stock, ships today if ordered before 12 pm',
    ])
    expect(availability(variant(0), true)).toEqual([
      'buy-buttons__availability text-small',
      'Available for pre-order',
    ])
  })

  it('reads as urgent only for the last few units', () => {
    expect(availability(variant(3))).toEqual([
      'buy-buttons__availability text-small buy-buttons__availability--low',
      'Only 3 left',
    ])
  })
})

const buttons = (v: Variant, isPreorder: boolean) =>
  renderToStaticMarkup(
    createElement(ProductBuyButtons, {
      product: product(v),
      variant: v,
      countdown: 0,
      isPreorder,
      onAddToCart: async () => undefined,
      stockBarShown: false,
      preorderLink: null,
    }),
  )

// #939: a pre-order page had no quantity picker and sold one at a time.
describe('the quantity picker on a pre-order', () => {
  it('shows, capped at stock plus the pre-order room when there is a limit', () => {
    const limited = buttons({ ...variant(1), preorderRoom: 4 }, true)
    expect(limited).toContain('quantity-input')
    expect(limited).toMatch(/max="5"/)
    expect(limited).not.toContain('buy-buttons__buy-now')
    const unlimited = buttons({ ...variant(0), preorderRoom: null }, true)
    expect(unlimited).toContain('quantity-input')
    expect(unlimited).not.toMatch(/max="/)
  })
})
