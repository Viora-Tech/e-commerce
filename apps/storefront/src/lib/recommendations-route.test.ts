import { beforeEach, describe, expect, it, vi } from 'vitest'

const recommendedProducts = vi.fn()
const renderRecommendations = vi.fn()
const rateLimited = vi.fn()

vi.mock('./liquid-theme', () => ({ renderRecommendations }))
vi.mock('./recommended-products', () => ({ recommendedProducts }))
vi.mock('./rate-limit', () => ({
  clientIp: () => '1.2.3.4',
  rateLimited,
  retryAfterSeconds: () => 30,
}))
vi.mock('./store-context', () => ({
  inStore: (_storeId: string, run: (tx: unknown) => unknown) => run({}),
}))

const { recommendationsResponse } = await import('./recommendations-route')

const get = (path: string) => new Request(`https://waimers.koomerce.app${path}`)

beforeEach(() => {
  vi.clearAllMocks()
  rateLimited.mockResolvedValue({ ok: true })
})

describe('recommendationsResponse', () => {
  it('answers products.json with the related products in Shopify shape', async () => {
    recommendedProducts.mockResolvedValue([])
    const res = await recommendationsResponse(
      get('/recommendations/products.json?product_id=771&limit=4&intent=complementary'),
      'store-1',
      true,
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ intent: 'complementary', products: [] })
    expect(recommendedProducts).toHaveBeenCalledWith({}, 'store-1', {
      productId: '771',
      limit: 4,
      intent: 'complementary',
      sectionId: '',
    })
    expect(renderRecommendations).not.toHaveBeenCalled()
  })

  it('renders the theme section when section_id is given', async () => {
    renderRecommendations.mockResolvedValue('<div>row</div>')
    const res = await recommendationsResponse(
      get('/recommendations/products?product_id=771&limit=4&section_id=template--1__related'),
      'store-1',
      false,
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(await res.text()).toBe('<div>row</div>')
    expect(renderRecommendations).toHaveBeenCalledWith({}, 'store-1', {
      productId: '771',
      limit: 4,
      intent: 'related',
      sectionId: 'template--1__related',
    })
  })

  it('ignores section_id on the .json endpoint', async () => {
    recommendedProducts.mockResolvedValue([])
    await recommendationsResponse(
      get('/recommendations/products.json?product_id=771&section_id=x'),
      'store-1',
      true,
    )
    expect(renderRecommendations).not.toHaveBeenCalled()
  })

  it('404s an unknown product or section, 422s a missing product_id', async () => {
    recommendedProducts.mockResolvedValue(null)
    renderRecommendations.mockResolvedValue(null)
    const json = await recommendationsResponse(
      get('/recommendations/products.json?product_id=9'),
      's',
      true,
    )
    expect(json.status).toBe(404)
    const html = await recommendationsResponse(
      get('/recommendations/products?product_id=9&section_id=nope'),
      's',
      false,
    )
    expect(html.status).toBe(404)
    const bad = await recommendationsResponse(
      get('/recommendations/products?section_id=x/../y'),
      's',
      false,
    )
    expect(bad.status).toBe(422)
    const badSection = await recommendationsResponse(
      get('/recommendations/products?product_id=1&section_id=x/../y'),
      's',
      false,
    )
    expect(badSection.status).toBe(404)
  })

  it('rate limits per IP like predictive search', async () => {
    rateLimited.mockResolvedValue({ ok: false })
    const res = await recommendationsResponse(
      get('/recommendations/products.json?product_id=1'),
      's',
      true,
    )
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('30')
    expect(rateLimited).toHaveBeenCalledWith('recommendations:ip', '1.2.3.4', expect.any(Object))
    expect(recommendedProducts).not.toHaveBeenCalled()
  })
})
