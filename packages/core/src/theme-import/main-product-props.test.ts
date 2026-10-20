/** SOURCE OF TRUTH: main-product props tests — WHAT: Shopify main-product section to product page props / WHY: imported product pages match the theme */
import { describe, expect, it } from 'vitest'
import { mainProductProps, plainText } from './main-product-props'
import { productDisplayFields } from './product-fields'

/** The Zero Drift theme's `templates/product.json` main section, trimmed. */
const zeroDrift = {
  type: 'main-product',
  block_order: [
    'title',
    'rating',
    'price',
    'payment_signals',
    'variant_picker',
    'stock_bar',
    'buy_buttons',
    'delivery_estimate',
    'specs_cells',
    'trust_badges',
    'acc2',
    'acc3',
    'acc_off',
    'whatsapp_ask',
    'share',
  ],
  settings: { gallery_layout: 'rail' },
  blocks: {
    title: { type: 'title' },
    rating: { type: 'rating' },
    price: { type: 'price' },
    payment_signals: {
      type: 'payment_signals',
      settings: {
        text: '<p>Extra 3% off on UPI &amp; bank transfer</p>',
        offer_heading: 'Extra 3% off on UPI & bank transfer',
        offer_body: '<p>Pay by UPI.</p>',
        offer_support_label: 'Still stuck? Message us',
        upi_percent: 3,
      },
    },
    variant_picker: { type: 'variant_picker' },
    stock_bar: { type: 'stock_bar', settings: { threshold: 25 } },
    buy_buttons: { type: 'buy_buttons', settings: { show_preorder_link: true } },
    delivery_estimate: {
      type: 'delivery_estimate',
      settings: { text: '<p>Ships within 24-48 business hours</p>' },
    },
    specs_cells: {
      type: 'spec_group',
      settings: { fields: 'Sensor | spec_sensor | sensor', rows: 'sensor | Sensor' },
    },
    trust_badges: {
      type: 'trust_badges',
      settings: {
        icon_1: 'guaranteed',
        label_1: '1-Year Warranty',
        icon_2: 'delivery',
        label_2: '',
        icon_4: 'payment',
        label_4: 'Secure payments',
        whatsapp_number: '919355074123',
        whatsapp_label: 'Ask us about this product',
        whatsapp_message: 'Hi, a question about the [product]:',
      },
    },
    acc2: {
      type: 'accordion',
      settings: { title: 'Specification', body: '', metafield_key: 'specification' },
    },
    acc3: {
      type: 'accordion',
      settings: { title: 'Warranty & claims', body: '<p>One year.</p>', metafield_key: '' },
    },
    acc_off: { type: 'accordion', disabled: true, settings: { title: 'Hidden', body: 'x' } },
    whatsapp_ask: { type: 'whatsapp_ask', settings: { label: 'Ask us', number: '1111' } },
    share: { type: 'share_row', settings: { label: 'Share' } },
  },
}

describe('mainProductProps', () => {
  it("turns the theme's product blocks into MainProduct settings", () => {
    const props = mainProductProps(zeroDrift)
    expect(props).toMatchObject({
      showRating: true,
      showVendor: false,
      showDescription: false,
      showShare: true,
      shareLabel: 'Share',
      showStockBar: true,
      stockThreshold: 25,
      showPreorderLink: true,
      showPaymentSignals: true,
      paymentNote: 'Extra 3% off on UPI & bank transfer',
      upiPercent: 3,
      offerHeading: 'Extra 3% off on UPI & bank transfer',
      offerBody: '<p>Pay by UPI.</p>',
      deliveryText: 'Ships within 24-48 business hours',
      showSpecs: true,
      specFields: 'Sensor | spec_sensor | sensor',
      specRows: 'sensor | Sensor',
      showTrustBadges: true,
      trustBadges: [
        { icon: 'guaranteed', label: '1-Year Warranty' },
        { icon: 'payment', label: 'Secure payments' },
      ],
      trustWhatsappLabel: 'Ask us about this product',
      // The first block that names a number keeps it.
      whatsappNumber: '919355074123',
      whatsappMessage: 'Hi, a question about the [product]:',
      showWhatsappAsk: true,
      whatsappAskLabel: 'Ask us',
      showAssurance: false,
      showAccordions: true,
      accordions: [
        { title: 'Specification', body: '', metafieldKey: 'specification' },
        { title: 'Warranty & claims', body: '<p>One year.</p>', metafieldKey: '' },
      ],
    })
    expect(props.galleryLayout).toBeUndefined()
  })

  it("reads Dawn's vendor text block, collapsible rows and an app rating badge", () => {
    const props = mainProductProps({
      type: 'main-product',
      block_order: ['vendor', 'title', 'badge', 'tab', 'description'],
      blocks: {
        vendor: { type: 'text', settings: { text: '{{ product.vendor }}' } },
        title: { type: 'title' },
        badge: { type: 'shopify://apps/judge-me-reviews/blocks/preview_badge/61cc' },
        tab: { type: 'collapsible_tab', settings: { heading: 'Sensor', content: '<p>XS-1</p>' } },
        description: { type: 'description' },
      },
    })
    expect(props).toMatchObject({
      showVendor: true,
      showRating: true,
      showDescription: true,
      showAccordions: true,
      accordions: [{ title: 'Sensor', body: '<p>XS-1</p>', metafieldKey: '' }],
      showSpecs: false,
    })
  })

  it('leaves our defaults alone for a section without a buy box', () => {
    expect(mainProductProps({ type: 'main-product', blocks: {} })).toEqual({})
  })

  it('reads a stacked gallery', () => {
    const props = mainProductProps({ ...zeroDrift, settings: { gallery_layout: 'stacked' } })
    expect(props.galleryLayout).toBe('stacked')
  })

  it('flattens theme rich text to one plain line', () => {
    expect(plainText('<p>A &amp; B</p><p>C<br>D</p>')).toBe('A & B C D')
    expect(plainText(null)).toBe('')
  })
})

describe('productDisplayFields', () => {
  type Field = Parameters<typeof productDisplayFields>[0][number]
  const f = (namespace: string, key: string, type: string, value: unknown, list = false) =>
    ({ namespace, key, type, list, measure: null, value }) as Field

  it('shapes custom fields as text and HTML, and picks up the imported rating', () => {
    const out = productDisplayFields([
      f('custom', 'spec_sensor', 'single_line_text', 'PixArt PAW3395'),
      f('custom', 'package_contents', 'multi_line_text', 'Mouse: 1\nCable: <USB-C>'),
      f('custom', 'notes', 'rich_text', '<p>Hand <strong>tuned</strong></p>'),
      f('custom', 'colours', 'single_line_text', ['Black', 'Clear'], true),
      f('custom', 'weight', 'weight', { value: 54, unit: 'G' }),
      f('custom', 'wireless', 'boolean', true),
      f('custom', 'blank', 'single_line_text', '  '),
      f('other', 'spec_sensor', 'single_line_text', 'ignored'),
      f('reviews', 'rating', 'rating', { value: '4.5', max: 5 }),
      f('reviews', 'rating_count', 'number_integer', 12),
    ])
    expect(out.fields).toEqual({
      spec_sensor: { text: 'PixArt PAW3395', html: 'PixArt PAW3395' },
      package_contents: {
        text: 'Mouse: 1\nCable: <USB-C>',
        html: 'Mouse: 1<br>Cable: &lt;USB-C&gt;',
      },
      notes: { text: 'Hand tuned', html: '<p>Hand <strong>tuned</strong></p>' },
      colours: { text: 'Black\nClear', html: '<ul><li>Black</li><li>Clear</li></ul>' },
      weight: { text: '54 g', html: '54 g' },
      wireless: { text: 'Yes', html: 'Yes' },
    })
    expect(out.rating).toEqual({ value: 4.5, count: 12 })
  })

  it('has no rating without a count', () => {
    expect(productDisplayFields([f('reviews', 'rating', 'rating', 5)]).rating).toBeNull()
  })
})
