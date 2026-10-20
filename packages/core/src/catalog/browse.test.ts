import {
  collection,
  collectionProduct,
  createDb,
  inventoryLevel,
  order,
  orderLine,
  product,
  productOption,
  productOptionValue,
  type StoreTx,
  store,
  variant,
  variantOptionValue,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { browseProducts, searchTerms, suggestProducts } from './browse'
import {
  activeFilters,
  browseHref,
  EMPTY_FILTERS,
  hasActiveFilters,
  parseBrowseFilters,
  parseBrowseSort,
  parsePage,
} from './browse-params'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  await resetDb(owner)
})

const run = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

type Seed = {
  handle: string
  price: number
  stock: number
  type?: string
  vendor?: string
  tags?: string[]
  sizes?: string[]
  createdAt?: Date
  title?: string
  description?: unknown
  sku?: string
}

async function seed(storeId: string, s: Seed) {
  const [p] = await owner
    .insert(product)
    .values({
      storeId,
      handle: s.handle,
      title: s.title ?? s.handle.replace(/-/g, ' '),
      description: s.description ?? null,
      status: 'active',
      productType: s.type ?? null,
      vendor: s.vendor ?? null,
      tags: s.tags ?? [],
      createdAt: s.createdAt ?? new Date('2026-01-01'),
    })
    .returning()
  const productId = p?.id as string
  const sizes = s.sizes ?? [null]
  const [opt] = s.sizes
    ? await owner.insert(productOption).values({ storeId, productId, name: 'Size' }).returning()
    : []
  const variants: string[] = []
  for (const [i, size] of sizes.entries()) {
    const [v] = await owner
      .insert(variant)
      .values({
        storeId,
        productId,
        title: size ?? 'Default',
        pricePaise: s.price + i * 100,
        sku: s.sku ? `${s.sku}-${i}` : null,
      })
      .returning()
    variants.push(v?.id as string)
    await owner
      .insert(inventoryLevel)
      .values({ storeId, variantId: v?.id as string, onHand: s.stock })
    if (opt && size) {
      const [ov] = await owner
        .insert(productOptionValue)
        .values({ storeId, optionId: opt.id, value: size, position: i })
        .returning()
      await owner
        .insert(variantOptionValue)
        .values({ storeId, variantId: v?.id as string, optionValueId: ov?.id as string })
    }
  }
  return { productId, variants }
}

const base = { filters: EMPTY_FILTERS, sort: 'title-ascending' as const, page: 1, perPage: 10 }

describe('browseProducts', () => {
  it('filters by availability, price, type, vendor, tag and option, with facets', async () => {
    const [s] = await owner.insert(store).values({ slug: 'b', name: 'B' }).returning()
    const storeId = s?.id as string
    await seed(storeId, {
      handle: 'alpha-mouse',
      price: 99_900,
      stock: 5,
      type: 'Mouse',
      vendor: 'Waimers',
      tags: ['wireless'],
    })
    await seed(storeId, {
      handle: 'beta-keyboard',
      price: 299_900,
      stock: 0,
      type: 'Keyboard',
      vendor: 'Keychron',
      tags: ['wired'],
    })
    await seed(storeId, {
      handle: 'gamma-tee',
      price: 49_900,
      stock: 3,
      type: 'Apparel',
      vendor: 'Waimers',
      sizes: ['S', 'M', 'L'],
    })

    const all = await run(storeId, (tx) => browseProducts(tx, base))
    expect(all.handles).toEqual(['alpha-mouse', 'beta-keyboard', 'gamma-tee'])
    expect(all.total).toBe(3)
    expect(all.facets).toMatchObject({
      inStock: 2,
      outOfStock: 1,
      priceMin: 49_900,
      priceMax: 299_900,
      vendors: [
        { value: 'Keychron', count: 1 },
        { value: 'Waimers', count: 2 },
      ],
      tags: [
        { value: 'wired', count: 1 },
        { value: 'wireless', count: 1 },
      ],
      options: [
        { key: 'size', name: 'Size', values: [{ value: 'S' }, { value: 'M' }, { value: 'L' }] },
      ],
    })

    const pick = async (params: Record<string, string | string[]>) =>
      (
        await run(storeId, (tx) =>
          browseProducts(tx, { ...base, filters: parseBrowseFilters(params) }),
        )
      ).handles
    expect(await pick({ 'filter.v.availability': '1' })).toEqual(['alpha-mouse', 'gamma-tee'])
    expect(await pick({ 'filter.v.availability': '0' })).toEqual(['beta-keyboard'])
    expect(await pick({ 'filter.v.availability': ['0', '1'] })).toHaveLength(3)
    expect(await pick({ 'filter.v.price.gte': '500', 'filter.v.price.lte': '1,000' })).toEqual([
      'alpha-mouse',
    ])
    expect(
      await pick({ 'filter.p.vendor': 'Waimers', 'filter.p.product_type': 'Apparel' }),
    ).toEqual(['gamma-tee'])
    expect(await pick({ 'filter.p.tag': ['wired', 'wireless'] })).toEqual([
      'alpha-mouse',
      'beta-keyboard',
    ])
    expect(await pick({ 'filter.v.option.Size': 'M' })).toEqual(['gamma-tee'])
    expect(await pick({ 'filter.v.option.size': 'XL' })).toEqual([])
  })

  it('sorts by price, newest, best selling and collection order, and pages', async () => {
    const [s] = await owner.insert(store).values({ slug: 'c', name: 'C' }).returning()
    const storeId = s?.id as string
    const a = await seed(storeId, {
      handle: 'a',
      price: 300,
      stock: 1,
      createdAt: new Date('2026-01-01'),
    })
    const b = await seed(storeId, {
      handle: 'b',
      price: 100,
      stock: 1,
      createdAt: new Date('2026-03-01'),
    })
    const c = await seed(storeId, {
      handle: 'c',
      price: 200,
      stock: 1,
      createdAt: new Date('2026-02-01'),
    })
    const [o] = await owner
      .insert(order)
      .values({ storeId, number: 1, subtotalPaise: 1, totalPaise: 1 })
      .returning()
    await owner.insert(orderLine).values({
      storeId,
      orderId: o?.id as string,
      variantId: c.variants[0] as string,
      quantity: 5,
      unitPricePaise: 200,
    })
    const [col] = await owner
      .insert(collection)
      .values({ storeId, handle: 'all', title: 'All', status: 'active' })
      .returning()
    for (const [i, p] of [b, a].entries()) {
      await owner
        .insert(collectionProduct)
        .values({ storeId, collectionId: col?.id as string, productId: p.productId, position: i })
    }

    const order_ = async (sort: Parameters<typeof browseProducts>[1]['sort'], extra = {}) =>
      (await run(storeId, (tx) => browseProducts(tx, { ...base, sort, ...extra }))).handles
    expect(await order_('price-ascending')).toEqual(['b', 'c', 'a'])
    expect(await order_('price-descending')).toEqual(['a', 'c', 'b'])
    expect(await order_('created-descending')).toEqual(['b', 'c', 'a'])
    expect(await order_('best-selling')).toEqual(['c', 'a', 'b'])
    expect(await order_('title-descending')).toEqual(['c', 'b', 'a'])
    expect(await order_('manual', { collectionId: col?.id })).toEqual(['b', 'a'])

    const second = await run(storeId, (tx) => browseProducts(tx, { ...base, page: 2, perPage: 2 }))
    expect(second).toMatchObject({ handles: ['c'], total: 3 })
    const beyond = await run(storeId, (tx) => browseProducts(tx, { ...base, page: 9, perPage: 2 }))
    expect(beyond).toMatchObject({ handles: [], total: 3 })
  })

  it('searches title, type, tags and SKU, best matches first', async () => {
    const [s] = await owner.insert(store).values({ slug: 'd', name: 'D' }).returning()
    const storeId = s?.id as string
    await seed(storeId, { handle: 'pro-mouse-pad', price: 100, stock: 1 })
    await seed(storeId, { handle: 'mouse-x', price: 100, stock: 0 })
    await seed(storeId, { handle: 'desk-mat', price: 100, stock: 1, tags: ['mouse'] })
    await seed(storeId, { handle: 'cable', price: 100, stock: 1 })
    const found = await run(storeId, (tx) =>
      browseProducts(tx, { ...base, query: 'mouse', sort: 'relevance' }),
    )
    expect(found.handles).toEqual(['mouse-x', 'pro-mouse-pad', 'desk-mat'])
    expect(await run(storeId, (tx) => suggestProducts(tx, 'mou'))).toEqual([
      'mouse-x',
      'pro-mouse-pad',
      'desk-mat',
    ])
    expect(await run(storeId, (tx) => suggestProducts(tx, 'm'))).toEqual([])
    expect(await run(storeId, (tx) => suggestProducts(tx, '100%'))).toEqual([])
  })

  it('searches vendor, handle, SKU, option values and description too, title matches first', async () => {
    const [s] = await owner.insert(store).values({ slug: 'e', name: 'E' }).returning()
    const storeId = s?.id as string
    const lexical = (text: string) => ({
      root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text }] }] },
    })
    await seed(storeId, {
      handle: 'zeta-pad',
      price: 100,
      stock: 1,
      description: lexical('Made by Pulsar'),
    })
    await seed(storeId, { handle: 'beta-mouse', price: 100, stock: 1, vendor: 'Pulsar' })
    await seed(storeId, { handle: 'pulsar-x2', title: 'X2 Wireless', price: 100, stock: 1 })
    await seed(storeId, { handle: 'gamma', price: 100, stock: 1, sku: 'PLS-PULSAR' })
    await seed(storeId, { handle: 'pulsar-x3', title: 'Pulsar X3', price: 100, stock: 1 })
    await seed(storeId, { handle: 'legacy', price: 100, stock: 1, description: 'old pulsar copy' })
    await seed(storeId, { handle: 'other', price: 100, stock: 1, description: lexical('paragraph') })
    await seed(storeId, { handle: 'tee', price: 100, stock: 1, sizes: ['Crimson'] })
    const search = (query: string) =>
      run(storeId, (tx) => browseProducts(tx, { ...base, query, sort: 'relevance' }))

    const found = await search('PULSAR')
    expect(found.handles[0]).toBe('pulsar-x3')
    expect(found.handles.slice(1, 4).sort()).toEqual(['beta-mouse', 'gamma', 'pulsar-x2'])
    expect(found.handles.slice(4).sort()).toEqual(['legacy', 'zeta-pad'])
    expect(found.total).toBe(6)
    // Lexical's node keys are not searchable text.
    expect((await search('paragraph')).handles).toEqual(['other'])
    // Every word must match, in any field.
    expect((await search('pulsar wireless')).handles).toEqual(['pulsar-x2'])
    // Option values, as Search & Discovery matches variant titles.
    expect((await search('crimson')).handles).toEqual(['tee'])
  })
})

describe('searchTerms', () => {
  it('splits, lowercases and dedupes words, at most eight', () => {
    expect(searchTerms('  Pulsar  X2 pulsar ')).toEqual(['pulsar', 'x2'])
    expect(searchTerms('')).toEqual([])
    expect(searchTerms('a b c d e f g h i j')).toHaveLength(8)
  })
})

describe('browse params', () => {
  it('parses Shopify-style params, ignoring junk', () => {
    const f = parseBrowseFilters({
      'filter.v.price.gte': '2000',
      'filter.v.price.lte': '500',
      'filter.p.tag': ['a', 'a', ' '],
      'filter.v.option.': 'x',
      'filter.v.availability': 'x',
    })
    expect(f).toMatchObject({
      priceMin: 50_000,
      priceMax: 200_000,
      tags: ['a'],
      options: {},
      available: null,
    })
    expect(parseBrowseFilters({ 'filter.v.price.gte': 'abc' }).priceMin).toBeNull()
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false)
    expect(hasActiveFilters(f)).toBe(true)
    expect(parseBrowseSort('price-ascending', ['manual', 'price-ascending'], 'manual')).toBe(
      'price-ascending',
    )
    expect(parseBrowseSort('evil', ['manual'], 'manual')).toBe('manual')
    expect(parsePage('3')).toBe(3)
    expect(parsePage('-1')).toBe(1)
    expect(parsePage(undefined)).toBe(1)
  })

  it('round-trips filters through URLs and removes one chip at a time', () => {
    const f = parseBrowseFilters({
      'filter.v.availability': '1',
      'filter.v.price.gte': '100',
      'filter.p.vendor': 'Waimers',
      'filter.v.option.size': ['S', 'M'],
    })
    const href = browseHref('/search', { q: 'tee', filters: f, sort: 'price-ascending', page: 2 })
    expect(href).toBe(
      '/search?q=tee&filter.v.availability=1&filter.v.price.gte=100&filter.p.vendor=Waimers&filter.v.option.size=S&filter.v.option.size=M&sort_by=price-ascending&page=2',
    )
    const back = Object.fromEntries(
      [...new URL(href, 'http://x').searchParams.keys()].map((k) => [
        k,
        new URL(href, 'http://x').searchParams.getAll(k),
      ]),
    )
    expect(parseBrowseFilters(back)).toEqual(f)
    const chips = activeFilters(f)
    expect(chips.map((c) => c.key)).toEqual([
      'available',
      'price',
      'vendor:Waimers',
      'option:size:S',
      'option:size:M',
    ])
    expect(chips[3]?.without.options).toEqual({ size: ['M'] })
    expect(activeFilters(chips[4]?.without as typeof f).map((c) => c.key)).toContain(
      'option:size:S',
    )
    expect(browseHref('/collections/x', {})).toBe('/collections/x')
  })
})
