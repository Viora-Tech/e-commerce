import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ProductBuyButtons from '../src/components/product-buy-buttons'
import ProductVariantPicker, { valueUnavailable } from '../src/components/product-variant-picker'
import { variantOnPreorder } from '../src/preorder-state'
import type { ProductDetail } from '../src/types'

type Variant = ProductDetail['variants'][number]

const NOTE =
  'This Product is on Pre-Order and will arrive around the end of November 2026. NOTE: Pre-orders cannot be cancelled and are non-refundable.'

// The ATK Blazing Sky X1 on Waimers, cut down: Model × Colour, X1 SE not on pre-order (#962).
const variant = (id: string, values: string[], over: Partial<Variant> = {}): Variant => ({
  id,
  title: id,
  sku: null,
  pricePaise: 749_900,
  mrpPaise: null,
  available: 0,
  purchasable: true,
  preorder: true,
  optionValueIds: values,
  imageUrl: null,
  ...over,
})

const product: ProductDetail = {
  id: 'p1',
  handle: 'atk-blazing-sky-x1',
  title: 'ATK Blazing Sky X1 Series Mouse',
  description: '',
  vendor: null,
  productType: null,
  images: [],
  options: [
    {
      id: 'model',
      name: 'Model',
      values: [
        { id: 'ultimate', value: 'Ultimate 2.0' },
        { id: 'air', value: 'Air+' },
        { id: 'se', value: 'X1 SE' },
      ],
    },
    {
      id: 'colour',
      name: 'Colour',
      values: [
        { id: 'black', value: 'Black' },
        { id: 'orange', value: 'Sunset Orange' },
      ],
    },
  ],
  variants: [
    variant('ultimate-black', ['ultimate', 'black']),
    variant('air-orange', ['air', 'orange']),
    // Sold out and its "Allow pre-order" off: the server marks it not purchasable.
    variant('se-black', ['se', 'black'], { preorder: false, purchasable: false }),
  ],
  preorder: {
    enabled: true,
    buttonLabel: 'Preorder',
    shipDate: '2026-11-30T04:30:00.000Z',
    depositPreview: null,
    note: NOTE,
  },
}

const withoutNote: ProductDetail = {
  ...product,
  preorder: {
    enabled: true,
    buttonLabel: 'Preorder',
    shipDate: null,
    depositPreview: null,
    note: null,
  },
}

const ultimate = product.variants[0] as Variant
const blocked = product.variants[2] as Variant

const buyButtons = (v: Variant) =>
  renderToStaticMarkup(
    createElement(ProductBuyButtons, {
      product,
      variant: v,
      countdown: 0,
      isPreorder: variantOnPreorder(product, v),
      onAddToCart: async () => undefined,
      stockBarShown: false,
      preorderLink: null,
    }),
  )

describe('the pre-order note under the button (#936)', () => {
  it('shows the note in place of "Available for pre-order"', () => {
    const html = buyButtons(ultimate)
    expect(html).toContain(`<p class="product-info__preorder-note text-small">${NOTE}</p>`)
    expect(html).not.toContain('Available for pre-order')
    expect(html).toContain('Preorder')
  })

  it('falls back to "Available for pre-order" when there is no note', () => {
    const html = renderToStaticMarkup(
      createElement(ProductBuyButtons, {
        product: withoutNote,
        variant: ultimate,
        countdown: 0,
        isPreorder: true,
        onAddToCart: async () => undefined,
        stockBarShown: false,
        preorderLink: null,
      }),
    )
    expect(html).toContain('Available for pre-order')
    expect(html).not.toContain('product-info__preorder-note')
  })
})

describe('pre-order per variant (#962)', () => {
  it('a variant that does not allow pre-order is no pre-order, and sells out', () => {
    expect(variantOnPreorder(product, ultimate)).toBe(true)
    expect(variantOnPreorder(product, blocked)).toBe(false)
    // Older data without the per-variant flag follows the product.
    expect(variantOnPreorder(product, { available: 0 })).toBe(true)
    expect(variantOnPreorder(product, { available: 2, preorder: true })).toBe(false)
    const html = buyButtons(blocked)
    expect(html).toContain('product-notify--sold-out')
    expect(html).not.toContain('product-info__preorder-note')
  })

  it('crosses out values that cannot be bought with the other values picked', () => {
    const [model, colour] = product.options as [
      ProductDetail['options'][number],
      ProductDetail['options'][number],
    ]
    const black = new Set(ultimate.optionValueIds)
    // X1 SE comes in Black but that one is not on pre-order; Air+ has no Black at all.
    expect(valueUnavailable(product, model, black, 'se')).toBe(true)
    expect(valueUnavailable(product, model, black, 'air')).toBe(true)
    expect(valueUnavailable(product, model, black, 'ultimate')).toBe(false)
    // Orange exists only on Air+, not with Ultimate 2.0 picked.
    expect(valueUnavailable(product, colour, black, 'orange')).toBe(true)
    expect(valueUnavailable(product, colour, black, 'black')).toBe(false)
    const html = renderToStaticMarkup(
      createElement(ProductVariantPicker, { product, variant: ultimate, onPick: () => {} }),
    )
    expect(html.match(/is-unavailable/g)?.length).toBe(3)
  })
})
