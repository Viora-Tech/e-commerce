import { beforeEach, describe, expect, it, vi } from 'vitest'

// The admin API client is mocked: no request ever leaves the test.
const api = vi.hoisted(() => ({
  products: { list: vi.fn() },
  collections: { list: vi.fn() },
  pages: { list: vi.fn() },
  blog: { list: vi.fn() },
}))
vi.mock('@/lib/api-client', () => ({ api }))

const { searchAllLinkTargets, searchLinkTargets } = await import('./customize-link-targets')

beforeEach(() => {
  api.products.list.mockResolvedValue({
    items: [{ id: 'p1', title: 'Glass pad', handle: 'glass-pad', imageUrl: null }],
  })
  api.collections.list.mockResolvedValue([
    { id: 'c1', title: 'Keyboards', handle: 'keyboards', imageUrl: null },
    { id: 'c2', title: 'Mice', handle: 'mice', imageUrl: null },
  ])
  api.pages.list.mockResolvedValue([
    { id: 'g1', title: 'About us', handle: 'about' },
    { id: 'g2', title: 'Refund policy', handle: 'refund-policy' },
  ])
  api.blog.list.mockRejectedValue(new Error('offline'))
})

describe('link target search', () => {
  it('searches one kind, splitting pages from policies', async () => {
    expect(await searchLinkTargets('collection', 'mic')).toEqual([
      { kind: 'collection', id: 'c2', title: 'Mice', href: '/collections/mice', imageUrl: null },
    ])
    expect((await searchLinkTargets('page', '')).map((t) => t.href)).toEqual(['/pages/about'])
    expect(await searchLinkTargets('policy', '')).toEqual([
      { kind: 'policy', id: 'g2', title: 'Refund policy', href: '/policies/refund-policy' },
    ])
  })

  it('searches every kind at once and skips the ones that fail or match nothing', async () => {
    const groups = await searchAllLinkTargets('')
    expect(groups.map((g) => g.kind)).toEqual(['product', 'collection', 'page', 'policy'])
    expect(groups[0]?.items[0]?.href).toBe('/products/glass-pad')
    expect(api.products.list).toHaveBeenCalledWith({ page: 1, perPage: 30 })
  })
})
