/** SOURCE OF TRUTH: lazy collection products tests — with a source that lists a collection's product handles, `collection.products` loads only the products a theme reads (`limit:`, `.first`, `.size` loads none) and renders exactly the HTML the eager list did, through the real engine on fake data. No database */
import { describe, expect, it } from 'vitest'
import {
  type FakeStoreData,
  FIXTURE_PRODUCT,
  fakeDataSource,
} from '../../test/theme-import-fixture'
import { buildThemeBundle } from './bundle'
import type { LiquidCollectionData, LiquidDataSource, LiquidProductData } from './drops'
import { createPageContext } from './page-context'
import { renderLiquidSection } from './render'

const collection = (n: number, handle: string, count: number): LiquidCollectionData => ({
  id: `01a0def6-6000-7000-8000-00000000000${n}`,
  handle,
  title: handle,
  descriptionHtml: '',
  image: null,
  productsCount: count,
})

const item = (n: number, tags: string[]): LiquidProductData => ({
  ...FIXTURE_PRODUCT,
  id: `01a0def6-3000-7000-8000-0000000000${String(n).padStart(2, '0')}`,
  handle: `p${n}`,
  title: `Product ${n}`,
  tags,
  vendor: n % 2 ? 'Pulsar' : 'Lamzu',
  variants: FIXTURE_PRODUCT.variants.map((v) => ({
    ...v,
    id: `${v.id.slice(0, -2)}${String(n).padStart(2, '0')}`,
    available: n !== 3,
  })),
})

const MICE = [1, 2, 3, 4, 5, 6].map((n) => item(n, n % 2 ? ['wireless'] : ['wired']))
const PADS = [7, 8].map((n) => item(n, ['pad']))
const MEMBERS: Record<string, LiquidProductData[]> = { mice: MICE, pads: PADS, empty: [] }

const DATA: FakeStoreData = {
  products: [...MICE, ...PADS],
  collections: [collection(1, 'mice', 6), collection(2, 'pads', 2), collection(3, 'empty', 0)],
}

let themes = 0

/** Renders `source` with every collection's products eager (`lazy: false`) or by handle. */
async function render(source: string, lazy: boolean) {
  const base = fakeDataSource(DATA)
  const loaded: string[] = []
  const all = [...MICE, ...PADS]
  const data: LiquidDataSource = {
    ...base,
    collectionsProducts: async (handles) =>
      new Map(handles.map((h) => [h, MEMBERS[h] ?? []] as const)),
    ...(lazy
      ? {
          collectionsProductHandles: async (handles: string[]) =>
            new Map(handles.map((h) => [h, (MEMBERS[h] ?? []).map((p) => p.handle)] as const)),
          products: async (handles: string[]) => {
            loaded.push(...handles)
            return new Map(
              all.filter((p) => handles.includes(p.handle)).map((p) => [p.handle, p] as const),
            )
          },
        }
      : {}),
  }
  const bundle = buildThemeBundle({
    themeId: `collection-products-lazy-${themes++}`,
    version: 'v1',
    textFiles: new Map([['sections/probe.liquid', source]]),
    assetChecksums: new Map(),
    settings: {},
  })
  const ctx = await createPageContext({
    bundle,
    data,
    request: {
      template: 'index',
      path: '/',
      host: 'shop.example',
      origin: 'https://shop.example',
      designMode: false,
      postedForm: null,
      nonce: '',
    },
    assetBase: '/theme-assets/x',
    shopifyHost: null,
    moneyFormat: null,
    paymentTypes: [],
  })
  let failure: unknown = null
  const html = await renderLiquidSection(
    ctx,
    { id: 'probe', type: 'probe', settings: {}, blocks: [], location: 'template', index: 0 },
    (err) => {
      failure = err
    },
  )
  if (failure) throw failure
  return { html: html.trim(), loaded: [...new Set(loaded)].sort() }
}

const C = "{%- assign c = collections['mice'] -%}"

describe('collection.products by handle', () => {
  it('a menu preview: size, three items and first load only those three', async () => {
    const source = `${C}{{ c.products.size }}|{% for p in c.products limit: 3 %}{{ p.title }},{% endfor %}|{{ c.products.first.title }}`
    const eager = await render(source, false)
    const lazy = await render(source, true)
    expect(lazy.html).toBe(eager.html)
    expect(lazy.html).toContain('6|Product 1,Product 2,Product 3,|Product 1')
    expect(lazy.loaded).toEqual(['p1', 'p2', 'p3'])
  })

  it('size alone loads no product', async () => {
    const lazy = await render(`${C}{{ c.products.size }}`, true)
    expect(lazy.html).toContain('6')
    expect(lazy.loaded).toEqual([])
  })

  it('every way of reading the whole list renders as before', async () => {
    const source = [
      C,
      '{% for p in c.products offset: 2 limit: 2 %}{{ p.handle }}{% endfor %}',
      '{% for p in c.products reversed %}{{ p.handle }}{% endfor %}',
      "{{ c.products | map: 'title' | join: '/' }}",
      "{{ c.products | where: 'available' | size }}",
      "{{ c.products | sort: 'title' | last | map: 'handle' }}",
      "{{ c.all_tags | join: ',' }}|{{ c.all_vendors | join: ',' }}",
      '{{ c.products.last.title }}|{{ c.products[4].handle }}|{{ c.products | json | size }}',
      '{%- for c2 in collections -%}{{ c2.handle }}:{% for p in c2.products limit: 1 %}{{ p.title }}{% endfor %};{%- endfor -%}',
      "{{ collections['empty'].products.size }}{% for p in collections['empty'].products %}x{% endfor %}",
      '{%- paginate c.products by 4 -%}{% for p in c.products %}{{ p.handle }}{% endfor %}{{ paginate.pages }}{%- endpaginate -%}',
    ].join('\n')
    const eager = await render(source, false)
    const lazy = await render(source, true)
    expect(lazy.html).toBe(eager.html)
    expect(lazy.html).toContain('p3p4')
    expect(lazy.html).toContain('wired,wireless|Lamzu,Pulsar')
  })
})
