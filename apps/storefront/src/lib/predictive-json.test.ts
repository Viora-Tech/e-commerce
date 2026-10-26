import { describe, expect, it } from 'vitest'
import { predictiveJson, predictiveParams } from './predictive-json'

const glide =
  'q=glasspad&resources[type]=product,collection,query&resources[limit]=6&resources[options][unavailable_products]=show'

describe('predictiveParams', () => {
  it("reads the params a theme's predictive search sends", () => {
    expect(predictiveParams(new URLSearchParams(glide))).toEqual({
      q: 'glasspad',
      limit: 6,
      products: true,
      collections: true,
      queries: true,
      unavailable: 'show',
    })
  })

  it("falls back to Shopify's defaults and caps the limit", () => {
    expect(predictiveParams(new URLSearchParams('q=%20pad%20&resources[limit]=50'))).toEqual({
      q: 'pad',
      limit: 10,
      products: true,
      collections: true,
      queries: false,
      unavailable: 'show',
    })
    const odd = predictiveParams(
      new URLSearchParams('q=x&resources[limit]=-1&resources[options][unavailable_products]=hide'),
    )
    expect(odd.limit).toBe(10)
    expect(odd.unavailable).toBe('hide')
  })
})

describe('predictiveJson', () => {
  it("answers in Shopify's suggest.json shape", () => {
    const body = predictiveJson(
      {
        terms: 'glass <pad>',
        products: [
          {
            id: '019a0000-0000-7123-8000-000000000000',
            handle: 'aria-glasspad',
            title: 'Aria Glasspad',
            vendor: 'Dysphoria',
            productType: 'Mousepad',
            pricePaise: 1149900,
            mrpPaise: 1249900,
            available: 0,
            preorder: { buttonLabel: 'Pre-order' },
            images: [
              {
                url: 'https://cdn/aria.png',
                alt: null,
                variants: { '320': { webp: 'https://cdn/aria-320.webp', avif: '' } },
              },
            ],
          },
        ],
        collections: [
          { id: 'not-a-v7', handle: 'glass-mousepads', title: 'Glasspads', imageUrl: null },
        ],
      },
      predictiveParams(new URLSearchParams(glide)),
    )
    const { products, collections, queries, pages, articles } = body.resources.results
    expect(products[0]).toMatchObject({
      handle: 'aria-glasspad',
      url: '/products/aria-glasspad',
      vendor: 'Dysphoria',
      type: 'Mousepad',
      available: true,
      price: '11499.00',
      compare_at_price_max: '12499.00',
      image: 'https://cdn/aria-320.webp',
      featured_image: { url: 'https://cdn/aria-320.webp', alt: 'Aria Glasspad' },
    })
    expect(typeof products[0]?.id).toBe('number')
    expect(collections).toEqual([
      {
        id: 'not-a-v7',
        handle: 'glass-mousepads',
        title: 'Glasspads',
        url: '/collections/glass-mousepads',
        featured_image: null,
      },
    ])
    expect(queries).toEqual([
      {
        text: 'glass <pad>',
        styled_text: '<mark>glass &#60;pad&#62;</mark>',
        url: '/search?q=glass%20%3Cpad%3E&options%5Bprefix%5D=last',
      },
    ])
    expect(pages).toEqual([])
    expect(articles).toEqual([])
  })
})
