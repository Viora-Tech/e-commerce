import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ProductView from '../src/components/product-view'
import { createBlocksConfig, type SectionMetadata } from '../src/puck-config'
import { withImportedDefaults } from '../src/sections/imported-defaults'
import { mainProductSettings } from '../src/sections/main-product-settings'
import type { ProductDetail } from '../src/types'

const product: ProductDetail = {
  id: 'p1',
  handle: 'viper',
  title: 'Viper V3',
  description: 'A light mouse for fast hands.',
  vendor: 'Razer',
  productType: 'Mouse',
  images: [
    { url: 'https://cdn.example.com/a.jpg', alt: 'Front' },
    { url: 'https://cdn.example.com/b.mp4', alt: 'Clip', contentType: 'video/mp4' },
  ],
  options: [
    {
      id: 'o1',
      name: 'Colour',
      values: [
        { id: 'black', value: 'Black' },
        { id: 'white', value: 'White' },
      ],
    },
  ],
  variants: [
    {
      id: 'v1',
      title: 'Black',
      sku: null,
      pricePaise: 1_000_000,
      mrpPaise: 1_200_000,
      available: 3,
      purchasable: true,
      optionValueIds: ['black'],
      imageUrl: null,
    },
    {
      id: 'v2',
      title: 'White',
      sku: null,
      pricePaise: 1_000_000,
      mrpPaise: null,
      available: 0,
      purchasable: false,
      optionValueIds: ['white'],
      imageUrl: null,
    },
  ],
}

const html = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el)

describe('MainProduct (ProductView)', () => {
  it('renders with the old props only', () => {
    const out = html(createElement(ProductView, { product, onAddToCart: async () => undefined }))
    expect(out).toContain('Viper V3')
    expect(out).toContain('variant-picker')
    expect(out).toContain('data-buy-buttons')
    expect(out).toContain('Add to cart')
    // Store-promise blocks are off by default.
    expect(out).not.toContain('trust-badges')
    expect(out).not.toContain('offer-note')
    // The stock bar is on: 3 of 25 left.
    expect(out).toContain('stock-bar')
    expect(out).not.toContain('src=""')
  })

  it('reads legacy saved settings as their defaults', () => {
    const s = mainProductSettings({ showEmiHint: false, showDeliveryEstimate: true })
    expect(s.showEmiHint).toBe(false)
    expect(s.showDeliveryEstimate).toBe(true)
    expect(s.galleryLayout).toBe('rail')
    expect(s.lensZoom).toBe(true)
    expect(s.showTrustBadges).toBe(false)
  })

  it('wraps the main image in the lens, not the video', () => {
    const out = html(createElement(ProductView, { product }))
    expect(out).toContain('product-gallery__lens')
    expect(out.match(/product-gallery__lens/g)).toHaveLength(1)
    const off = html(
      createElement(ProductView, { product, settings: mainProductSettings({ lensZoom: false }) }),
    )
    expect(off).not.toContain('product-gallery__lens')
  })

  it('renders every buy-box block when switched on', () => {
    const settings = mainProductSettings({
      ratingValue: 4.6,
      ratingCount: 12,
      showPaymentSignals: true,
      showTrustBadges: true,
      showAssurance: true,
      showAccordions: true,
      showReturnsLine: true,
      showWhatsappAsk: true,
      showShare: true,
      deliveryText: 'Ships within 24-48 business hours',
      whatsappNumber: '+91 98765 43210',
    })
    const out = html(createElement(ProductView, { product, settings, belowBuy: 'PINCODE' }))
    expect(out).toContain('product-info__rating')
    expect(out).toContain('(12)')
    // ₹10,000 less 3% → ₹9,700 with UPI.
    expect(out).toContain('offer-note--inline')
    expect(out).toContain('with UPI')
    expect(out).toContain('trust-badges__item--ask')
    expect(out).toContain('https://wa.me/919876543210?text=')
    expect(out).toContain('assurance')
    expect(out).toContain('Warranty &amp; claims')
    expect(out).not.toContain('>Specification<')
    expect(out).toContain('returns-line')
    expect(out).toContain('whatsapp-ask')
    expect(out).toContain('share-row')
    expect(out).toContain('Ships within 24-48 business hours')
    expect(out).toContain('PINCODE')
  })

  it('stands down dispatch promises on a sold-out or pre-order product', () => {
    const soldOut: ProductDetail = {
      ...product,
      variants: product.variants.map((v) => ({ ...v, available: 0, purchasable: false })),
    }
    const settings = mainProductSettings({
      showTrustBadges: true,
      deliveryText: 'Ships today',
    })
    const out = html(
      createElement(ProductView, { product: soldOut, settings, belowBuy: 'PINCODE' }),
    )
    expect(out).not.toContain('PINCODE')
    expect(out).not.toContain('Ships within 24-48 business hours')
    expect(out).toContain('1-Year Warranty')
    expect(out).toContain('Sold out')
  })

  it('draws inline-edited copy passed as React nodes', () => {
    const node = createElement('span', { 'data-inline': 'x' }, 'x')
    const settings = mainProductSettings({
      showTrustBadges: true,
      trustBadges: [{ icon: 'shipping', label: node }],
    })
    expect(html(createElement(ProductView, { product, settings }))).toContain('data-inline')
  })
})

describe('product-page extras on an imported theme (#1049)', () => {
  const UnderPrice = () => createElement('p', null, 'EMI-LINE')
  const extras = { UnderPrice, belowBuy: 'PINCODE' }
  const dispatch = { deliveryText: 'Ships within 24-48 business hours' }

  it('keeps every extra on for our own themes', () => {
    const settings = mainProductSettings(dispatch)
    const out = html(createElement(ProductView, { product, settings, ...extras }))
    expect(out).toContain('Inclusive of all taxes')
    expect(out).toContain('price__save')
    expect(out).toContain('EMI-LINE')
    expect(out).toContain('Ships within 24-48 business hours')
    expect(out).toContain('PINCODE')
  })

  it('reads a section saved without the switches as off on an imported theme', () => {
    const saved = withImportedDefaults({ type: 'MainProduct', props: { id: 'm', ...dispatch } })
    const settings = mainProductSettings(saved.props)
    expect(settings).toMatchObject({
      showEmiHint: false,
      showTaxNote: false,
      showSaving: false,
      showUpiPrice: false,
      showDispatchLine: false,
      showDeliveryEstimate: false,
    })
    const out = html(createElement(ProductView, { product, settings, ...extras }))
    expect(out).not.toContain('Inclusive of all taxes')
    expect(out).not.toContain('price__save')
    expect(out).not.toContain('EMI-LINE')
    expect(out).not.toContain('Ships within 24-48 business hours')
    expect(out).not.toContain('PINCODE')
    // The price itself and the MRP stay.
    expect(out).toContain('price__compare')
  })

  it('lets the merchant switch each one back on', () => {
    const saved = withImportedDefaults({
      type: 'MainProduct',
      props: { id: 'm', showTaxNote: true, showDeliveryEstimate: true },
    })
    const out = html(
      createElement(ProductView, {
        product,
        settings: mainProductSettings(saved.props),
        ...extras,
      }),
    )
    expect(out).toContain('Inclusive of all taxes')
    expect(out).toContain('PINCODE')
    expect(out).not.toContain('EMI-LINE')
  })

  it('leaves other sections and our own section types alone', () => {
    const other = { type: 'RichText', props: { id: 'r' } }
    expect(withImportedDefaults(other)).toBe(other)
  })
})

describe('StickyAtc', () => {
  const config = createBlocksConfig(async () => [])
  const component = config.components.StickyAtc
  const render = (metadata: SectionMetadata, isEditing = false) =>
    renderToStaticMarkup(
      // @ts-expect-error -- loose test props against the config's widened component type
      component.render({ ...component.defaultProps, puck: { metadata, isEditing } }),
    )

  it('renders nothing without a product', () => {
    expect(render({})).toBe('')
  })

  it('renders the bar with the product, price and Add to cart', () => {
    const out = render({ product, productActions: { addToCart: async () => undefined } })
    expect(out).toContain('sticky-atc sticky-atc--corner')
    expect(out).toContain('Viper V3')
    expect(out).toContain('price__current')
    expect(out).toContain('Add to cart')
    // Hidden until the main buy buttons scroll away.
    expect(out).toContain('hidden=""')
  })

  it('is drawn in place in the editor', () => {
    const out = render({ product }, true)
    expect(out).toContain('sticky-atc--preview')
    expect(out).not.toContain('hidden=""')
  })
})
