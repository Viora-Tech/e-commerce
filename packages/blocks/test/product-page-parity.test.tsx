import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { upiPricePaise } from '../src/components/product-payment-signals'
import { swatchImages } from '../src/components/product-variant-picker'
import ProductView from '../src/components/product-view'
import { specCells, specRows, specTable } from '../src/product-specs'
import { mainProductSettings } from '../src/sections/main-product-settings'
import type { ProductDetail, ProductFieldText } from '../src/types'

const field = (text: string): ProductFieldText => ({ text, html: text.replace(/\n/g, '<br>') })

const fields: Record<string, ProductFieldText> = {
  spec_sensor: field('PixArt PAW3395'),
  spec_dpi: field('26,000'),
  spec_weight: field('54g ±1g'),
  package_contents: field('Mouse: 1\nCable: USB-C'),
}

const variant = (
  id: string,
  value: string,
  over: Partial<ProductDetail['variants'][number]> = {},
): ProductDetail['variants'][number] => ({
  id,
  title: value,
  sku: null,
  pricePaise: 649_900,
  mrpPaise: 999_900,
  available: 0,
  purchasable: false,
  optionValueIds: [value],
  imageUrl: `https://cdn.example.com/${value}.webp`,
  ...over,
})

const product: ProductDetail = {
  id: 'p1',
  handle: 'x2h-gaming-mouse',
  title: 'X2H Gaming Mouse',
  description: null,
  vendor: 'Waimers',
  productType: null,
  images: [
    { url: 'https://cdn.example.com/black.webp', alt: null },
    { url: 'https://cdn.example.com/clear.webp', alt: null },
  ],
  options: [
    {
      id: 'colour',
      name: 'Colour',
      values: [
        { id: 'black', value: 'Black' },
        { id: 'clear', value: 'Clear' },
      ],
    },
  ],
  variants: [variant('v1', 'black'), variant('v2', 'clear')],
  fields,
  collection: { title: 'Deals', url: '/collections/deals' },
}

const html = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el)

describe('spec helpers', () => {
  it('spec cells keep the fields the product has, and a group label only above a shown cell', () => {
    const spec =
      '## Performance\nSensor | spec_sensor | sensor\nPolling | spec_polling | speed\n## Build\nBase | spec_base\nWeight | spec_weight | weight'
    expect(specCells(fields, spec)).toEqual([
      { label: 'Sensor', value: 'PixArt PAW3395', icon: 'sensor', group: 'Performance' },
      { label: 'Weight', value: '54g ±1g', icon: 'weight', group: 'Build' },
    ])
    expect(specCells(undefined, spec)).toEqual([])
  })

  it('spec rows split on the first colon and keep a sub-line', () => {
    expect(specRows('Sensor: PAW3395 | flagship\nWireless Mouse x 1\nRatio: 1:2')).toEqual([
      { label: 'Sensor', value: 'PAW3395', sub: 'flagship' },
      { label: '', value: 'Wireless Mouse x 1', sub: '' },
      { label: 'Ratio', value: '1:2', sub: '' },
    ])
  })

  it('the spec table finds `key` or `spec_key` and leaves out omitted keys', () => {
    const rows = 'sensor | Sensor\ndpi | Max DPI\nweight | Weight\nmount | Mount'
    expect(specTable(fields, rows, ['weight']).map((r) => [r.label, r.value])).toEqual([
      ['Sensor', 'PixArt PAW3395'],
      ['Max DPI', '26,000'],
    ])
  })
})

describe('variant swatches', () => {
  it('uses each value’s own variant image', () => {
    const option = product.options[0]
    expect(option && swatchImages(product, option)).toEqual(
      new Map([
        ['black', 'https://cdn.example.com/black.webp'],
        ['clear', 'https://cdn.example.com/clear.webp'],
      ]),
    )
  })

  it('keeps pills when a value has no image, or values share one image', () => {
    const option = product.options[0]
    if (!option) throw new Error('fixture')
    const missing = {
      ...product,
      variants: [variant('v1', 'black'), variant('v2', 'clear', { imageUrl: null })],
    }
    expect(swatchImages(missing, option)).toBeNull()
    const shared = {
      ...product,
      variants: [
        variant('v1', 'black'),
        variant('v2', 'clear', { imageUrl: 'https://cdn.example.com/black.webp' }),
      ],
    }
    expect(swatchImages(shared, option)).toBeNull()
  })

  it('draws the radio before its label so the checked style applies', () => {
    const out = html(createElement(ProductView, { product }))
    expect(out).toContain('variant-picker__values--swatch')
    expect(out).toContain('variant-picker__swatch-circle')
    expect(out).toMatch(/<input[^>]*variant-picker__radio[^>]*\/><label for="variant-colour-black"/)
  })
})

describe('UPI price', () => {
  it('applies the store’s discount the way checkout does', () => {
    // −3% (−300 basis points) of ₹6,499 is −₹194.97, rounded to −₹195.
    expect(upiPricePaise(649_900, { type: 'percent', value: -300 })).toBe(630_403)
    expect(upiPricePaise(649_900, { type: 'fixed', value: -5_000 })).toBe(644_900)
    expect(upiPricePaise(1_000, { type: 'fixed', value: -5_000 })).toBe(0)
  })

  const inStock = {
    ...product,
    variants: [variant('v1', 'black', { available: 4, purchasable: true })],
  }
  const settings = mainProductSettings({ showPaymentSignals: true, upiPercent: 3 })

  it('shows "with UPI" from the store’s discount', () => {
    const out = html(
      createElement(ProductView, {
        product: inStock,
        settings,
        upiDiscount: { type: 'percent', value: -300 },
      }),
    )
    expect(out).toContain('offer-note--inline')
    expect(out).toContain('6,304')
  })

  it('hides a UPI price note when the store has no UPI discount', () => {
    const out = html(createElement(ProductView, { product: inStock, settings, upiDiscount: null }))
    expect(out).not.toContain('offer-note')
  })
})

describe('buy box parity', () => {
  it('names the collection in the breadcrumb', () => {
    const out = html(createElement(ProductView, { product }))
    expect(out).toContain('href="/collections/deals"')
    expect(out).toContain('>Deals<')
  })

  it('replaces the buttons with the sold-out panel and the notify form', () => {
    const NotifyMe = ({ variantId }: { variantId: string }) =>
      createElement('form', { 'data-notify': variantId })
    const out = html(
      createElement(ProductView, {
        product,
        NotifyMe,
        notifyMeProps: { whatsappEnabled: false },
      }),
    )
    expect(out).toContain('product-notify--sold-out')
    expect(out).toContain('Currently out of stock')
    expect(out).toContain('status-chip--out')
    expect(out).toContain('data-notify="v1"')
    expect(out).not.toContain('buy-buttons__submit')
  })

  it('says the product is sold out without a form when the app is not installed', () => {
    const out = html(createElement(ProductView, { product }))
    expect(out).toContain('Currently out of stock')
    expect(out).toContain('Every variant is gone for now.')
    expect(out).not.toContain('<form')
  })

  it('sells a pre-order with its button and ship date, badge only while out of stock', () => {
    const preorder: ProductDetail = {
      ...product,
      variants: [variant('v1', 'black', { purchasable: true })],
      preorder: {
        enabled: true,
        buttonLabel: 'Pre-order',
        shipDate: '2026-11-20T00:00:00.000Z',
        depositPreview: null,
      },
    }
    const out = html(createElement(ProductView, { product: preorder }))
    expect(out).toContain('buy-buttons__submit--preorder')
    expect(out).toContain('Expected to ship')
    expect(out).toContain('product-info__preorder-badge')
    expect(out).not.toContain('product-notify')
    const inStock = {
      ...preorder,
      variants: [variant('v1', 'black', { available: 5, purchasable: true })],
    }
    expect(html(createElement(ProductView, { product: inStock }))).not.toContain(
      'product-info__preorder-badge',
    )
  })

  it('draws the spec grid and fills accordions from the product’s fields', () => {
    const settings = mainProductSettings({
      showSpecs: true,
      specFields: 'Sensor | spec_sensor | sensor\nMax DPI | spec_dpi | speed',
      specRows: 'sensor | Sensor\ndpi | Max DPI\nweight | Weight',
      showAccordions: true,
      accordions: [
        { title: 'Specification', body: '', metafieldKey: 'specification' },
        { title: 'Package contents', body: '', metafieldKey: 'package_contents' },
        { title: 'Dimensions', body: '', metafieldKey: 'dimensions' },
        { title: 'Warranty', body: '<p>One year.</p>', metafieldKey: '' },
      ],
    })
    const out = html(createElement(ProductView, { product, settings }))
    expect(out).toContain('spec-grid__item')
    expect(out).toContain('icon--sensor')
    // Specification: no written spec, so the sheet from the rows (weight left out).
    expect(out).toContain('<dt class="spec-table__label">Max DPI</dt>')
    expect(out).not.toContain('<dt class="spec-table__label">Weight</dt>')
    // Package contents from the field; Dimensions has no field and no text, so no panel.
    expect(out).toContain('Mouse: 1<br />Cable: USB-C')
    expect(out).not.toContain('>Dimensions<')
    expect(out).toContain('One year.')
  })

  it('shows the real rating with its average', () => {
    const settings = mainProductSettings({ ratingValue: 5, ratingCount: 1 })
    const out = html(createElement(ProductView, { product, settings }))
    expect(out).toContain('product-info__rating-value">5.0<')
    expect(out).toContain('(1)')
    const none = mainProductSettings({ ratingValue: 0, ratingCount: 0 })
    expect(html(createElement(ProductView, { product, settings: none }))).not.toContain(
      'product-info__rating',
    )
  })
})
