import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import MoneyFormatProvider from '../src/components/money-format-provider'
import ProductCard from '../src/components/product-card'
import type { CardProduct } from '../src/types'

const card = (over: Partial<CardProduct> = {}): CardProduct => ({
  id: 'p1',
  handle: 'wlmouse-beast-v2',
  title: 'WLMOUSE BeastX V2',
  vendor: 'WLMOUSE',
  productType: 'Mice',
  pricePaise: 649_900,
  mrpPaise: null,
  available: 0,
  images: [],
  quickAddVariantId: 'v1',
  ...over,
})

describe('product card stock state', () => {
  it('shows Sold out when nothing is left and it is not on pre-order', () => {
    const html = renderToStaticMarkup(<ProductCard product={card()} />)
    expect(html).toContain('Sold out')
    expect(html).not.toContain('Pre-order')
  })

  it('shows a Pre-order badge and a purchasable Pre-order button past zero stock', () => {
    const html = renderToStaticMarkup(
      <ProductCard product={card({ preorder: { buttonLabel: 'Pre-order' } })} quickAdd />,
    )
    expect(html).toContain('product-card__badge--preorder')
    expect(html).not.toContain('Sold out')
    expect(html).toMatch(/<button[^>]*product-card__quick-add"[^>]*>Pre-order<\/button>/)
    expect(html).not.toMatch(/product-card__quick-add"[^>]*disabled/)
  })

  it('sells normally while stock is left, even with pre-order switched on', () => {
    const html = renderToStaticMarkup(
      <ProductCard product={card({ available: 20, preorder: { buttonLabel: 'Pre-order' } })} />,
    )
    expect(html).not.toContain('product-card__badge--preorder')
    expect(html).toContain('Quick add')
  })
})

describe('price format', () => {
  it('uses the currency format by default', () => {
    const html = renderToStaticMarkup(<ProductCard product={card({ available: 20 })} />)
    expect(html).toContain('₹6,499')
  })

  it("uses the store's Shopify money format when set", () => {
    const html = renderToStaticMarkup(
      <MoneyFormatProvider format="Rs. {{amount}}">
        <ProductCard product={card({ available: 20 })} />
      </MoneyFormatProvider>,
    )
    expect(html).toContain('Rs. 6,499.00')
    expect(html).not.toContain('₹')
  })
})
