/** SOURCE OF TRUTH: `product.collections` tests — the collections a product is in, as collection drops (handle, title, products), and the add-ons pattern themes build on them (pick accessories by the product's kind of collection), rendered through the real engine on fake data. No database */
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

const collection = (n: number, handle: string, title: string): LiquidCollectionData => ({
  id: `01a0def6-6000-7000-8000-00000000000${n}`,
  handle,
  title,
  descriptionHtml: '',
  image: null,
  productsCount: 1,
})

const accessory = (n: number, handle: string, title: string, available: boolean) => ({
  ...FIXTURE_PRODUCT,
  id: `01a0def6-3000-7000-8000-00000000000${n}`,
  handle,
  title,
  variants: FIXTURE_PRODUCT.variants.map((v) => ({ ...v, id: `${v.id.slice(0, -1)}${n}`, available })),
})

const MOUSE: LiquidProductData = { ...FIXTURE_PRODUCT, collectionHandles: ['mice', 'pulsar'] }
const SKATES = accessory(1, 'skates', 'Magic Ice skates', true)
const TAPE = accessory(2, 'tape', 'Supergrip tape', false)

const DATA: FakeStoreData = {
  collections: [
    collection(1, 'mice', 'Mice'),
    collection(2, 'pulsar', 'Pulsar'),
    collection(3, 'accessories', 'Accessories'),
  ],
}

let themes = 0

async function render(source: string, product: LiquidProductData = MOUSE) {
  const base = fakeDataSource(DATA)
  const data: LiquidDataSource = {
    ...base,
    product: async (h) => (h === 'mouse' ? product : base.product(h)),
    collectionProducts: async (h) => (h === 'accessories' ? [SKATES, TAPE] : []),
  }
  const bundle = buildThemeBundle({
    themeId: `product-collections-${themes++}`,
    version: 'v1',
    textFiles: new Map([['sections/probe.liquid', source]]),
    assetChecksums: new Map(),
    settings: {},
  })
  const ctx = await createPageContext({
    bundle,
    data,
    request: {
      template: 'product',
      path: '/products/mouse',
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
  return html.trim()
}

const P = "{%- assign p = all_products['mouse'] -%}"

describe('product.collections', () => {
  it('lists the collections the product is in, as collections', async () => {
    const html = await render(
      `${P}{{ p.collections.size }}:{% for c in p.collections %}{{ c.handle }}={{ c.title }}={{ c.url }};{% endfor %}`,
    )
    expect(html).toBe('2:mice=Mice=/collections/mice;pulsar=Pulsar=/collections/pulsar;')
  })

  it('reads empty when the product carries no memberships', async () => {
    const html = await render(`${P}[{{ p.collections.size }}]`, FIXTURE_PRODUCT)
    expect(html).toBe('[0]')
  })

  it('leaves out a collection that is not published', async () => {
    const html = await render(`${P}{{ p.collections | map: 'handle' | join: ',' }}`, {
      ...MOUSE,
      collectionHandles: ['mice', 'hidden'],
    })
    expect(html).toBe('mice')
  })

  it('drives an add-ons row: the kind from the collections, buyable accessories only', async () => {
    const html = await render(`${P}{%- liquid
      assign kind = ''
      for c in p.collections
        if c.handle == 'mice'
          assign kind = 'mice'
        endif
      endfor
      if kind == 'mice'
        for a in collections.accessories.products
          if a.available
            echo a.handle
          endif
        endfor
      endif
    -%}`)
    expect(html).toBe('skates')
  })
})
