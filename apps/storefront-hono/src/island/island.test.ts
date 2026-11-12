import { describe, expect, it } from 'vitest'
import { ISLAND_MARK, placeIsland, splitPreloads } from './place'
import { type IslandProps, parseIslandProps, serializeIslandProps } from './props'

const props = (over: Partial<IslandProps> = {}): IslandProps =>
  ({
    product: {
      id: 'p1',
      handle: 'blue-tee',
      title: 'Blue </script><script>alert(1)</script> tee',
      description: 'Line\u2028break\u2029here',
      launchAt: null,
      images: [],
      variants: [{ id: 'v1', pricePaise: 49900, mrpPaise: null, purchasable: true }],
    },
    settings: { showRating: true, ratingValue: 4.5, ratingCount: 12 },
    upiDiscount: { type: 'percent', value: 5 },
    policyPanels: [],
    underPrice: 'emi-offers',
    emiConfig: { minPricePaise: 300000, razorpayKeyId: null },
    notifyMe: { whatsappEnabled: true },
    moneyFormat: 'Rs. {{amount}}',
    pricing: null,
    cartHref: '/cart',
    framed: false,
    viewContent: { name: 'ViewContent', productId: 'p1', variantId: 'v1', valuePaise: 49900 },
    ...over,
  }) as unknown as IslandProps

describe('island props serialisation', () => {
  it('comes back the same in the browser', () => {
    const p = props()
    expect(parseIslandProps(serializeIslandProps(p))).toEqual(p)
  })

  it('can never close its script or break a line in it', () => {
    const json = serializeIslandProps(props())
    expect(json).not.toContain('<')
    expect(json).not.toMatch(/[\u2028\u2029]/)
    expect(parseIslandProps(json).product.title).toContain('</script>')
  })

  it('drops an undefined field as the browser would read it (absent)', () => {
    const p = props({ viewContent: { name: 'ViewContent', productId: 'p1', variantId: undefined } })
    expect(parseIslandProps(serializeIslandProps(p)).viewContent).toEqual({
      name: 'ViewContent',
      productId: 'p1',
    })
  })

  it('refuses values JSON would change, so Next draws that page instead', () => {
    const withDate = props()
    ;(withDate.product as unknown as Record<string, unknown>).launchAt = new Date()
    expect(() => serializeIslandProps(withDate)).toThrow(/Date/)
    const withMap = props({ pricing: new Map() as unknown as IslandProps['pricing'] })
    expect(() => serializeIslandProps(withMap)).toThrow(/Map/)
    const withFn = props({ cartHref: (() => '/cart') as unknown as string })
    expect(() => serializeIslandProps(withFn)).toThrow(/function/)
    const withNaN = props({ settings: { ratingValue: Number.NaN } as IslandProps['settings'] })
    expect(() => serializeIslandProps(withNaN)).toThrow(/number/)
    const withHole = props({ policyPanels: [undefined] as unknown as IslandProps['policyPanels'] })
    expect(() => serializeIslandProps(withHole)).toThrow(/undefined/)
  })
})

describe('placeIsland', () => {
  const island = '<section class="section-product page-width">…</section>'

  it('puts the island where the section drew only the mark', () => {
    expect(placeIsland(ISLAND_MARK, island)).toEqual({ html: island, framed: false })
  })

  it('keeps the section frame around it and says so', () => {
    const shell = `<div style="padding-top:1rem" class="section-frame color-scheme-2">${ISLAND_MARK}</div>`
    expect(placeIsland(shell, island)).toEqual({
      html: `<div style="padding-top:1rem" class="section-frame color-scheme-2">${island}</div>`,
      framed: true,
    })
  })

  it('refuses anything else beside the island (the page goes to Next)', () => {
    expect(
      placeIsland(`<div class="section-frame"><style>a{}</style>${ISLAND_MARK}</div>`, island),
    ).toBeNull()
    expect(placeIsland(`<div class="other">${ISLAND_MARK}</div>`, island)).toBeNull()
    expect(placeIsland('', island)).toBeNull()
  })

  it('moves React image preloads out of the island', () => {
    const preload = '<link rel="preload" as="image" href="/a.avif" fetchPriority="high"/>'
    expect(splitPreloads(`${preload}${island}`)).toEqual({ preloads: preload, body: island })
    expect(splitPreloads(island)).toEqual({ preloads: '', body: island })
  })
})
