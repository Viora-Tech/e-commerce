/** SOURCE OF TRUTH: dynamic source loader tests (database) — values per source, RLS, Save's binding check */
import {
  collection,
  createDb,
  media,
  product,
  productMedia,
  type StoreTx,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  createDefinition,
  createEntry,
  createMetafieldDefinition,
  setMetafields,
} from '../metaobjects/service'
import { applyBindings } from './format'
import {
  assertTemplateBindings,
  InvalidBindings,
  loadSourceCatalog,
  loadSourceValues,
} from './service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

async function seed(slug = 'w') {
  const [s] = await owner
    .insert(store)
    .values({ slug, name: `Store ${slug}`, contactEmail: `${slug}@shop.in`, contactPhone: '9999' })
    .returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({
      storeId: s.id,
      title: 'Viper Mouse',
      handle: 'viper',
      vendor: 'Razer',
      productType: 'Mouse',
      categoryId: 'el',
      status: 'active',
    })
    .returning()
  if (!p) throw new Error('seed product')
  await owner.insert(variant).values([
    { storeId: s.id, productId: p.id, title: 'Black', pricePaise: 499900, mrpPaise: 599900 },
    { storeId: s.id, productId: p.id, title: 'White', pricePaise: 549900, position: 1 },
  ])
  const [m] = await owner
    .insert(media)
    .values({ storeId: s.id, url: 'https://cdn.test/viper.jpg', alt: null })
    .returning()
  if (!m) throw new Error('seed media')
  await owner.insert(productMedia).values({ storeId: s.id, productId: p.id, mediaId: m.id })
  const [c] = await owner
    .insert(collection)
    .values({ storeId: s.id, title: 'Mice', handle: 'mice', imageMediaId: m.id })
    .returning()
  if (!c) throw new Error('seed collection')
  return { storeId: s.id, productId: p.id, collectionId: c.id, mediaId: m.id }
}

describe('loadSourceValues', () => {
  it('reads product fields, the cheapest price and its compare-at, and images', async () => {
    const { storeId, productId } = await seed()
    const values = await inStore(storeId, (tx) =>
      loadSourceValues(
        tx,
        [
          'product.title',
          'product.vendor',
          'product.type',
          'product.price',
          'product.compare_at_price',
          'product.featured_image',
          'product.images.1',
          'product.url',
          'product.category',
        ],
        { storeId, productId },
      ),
    )
    expect(values['product.title']).toEqual({ type: 'single_line_text', value: 'Viper Mouse' })
    expect(values['product.vendor']?.value).toBe('Razer')
    expect(values['product.type']?.value).toBe('Mouse')
    expect(values['product.price']).toEqual({ type: 'money', value: 499900 })
    expect(values['product.compare_at_price']?.value).toBe(599900)
    expect(values['product.featured_image']?.value).toEqual({
      url: 'https://cdn.test/viper.jpg',
      alt: 'Viper Mouse',
    })
    expect(values['product.images.1']?.value).toBeNull()
    expect(values['product.url']?.value).toBe('/products/viper')
    expect(values['product.category']?.value).toBe('Electronics')
  })

  it('reads product metafields and only the ones asked for', async () => {
    const { storeId, productId } = await seed()
    await inStore(storeId, async (tx) => {
      const material = await createMetafieldDefinition(tx, storeId, {
        ownerType: 'product',
        name: 'Material',
        namespace: 'custom',
        type: 'single_line_text',
        list: false,
        validations: {},
        storefrontAccess: true,
      })
      const care = await createMetafieldDefinition(tx, storeId, {
        ownerType: 'product',
        name: 'Care',
        namespace: 'custom',
        type: 'single_line_text',
        list: false,
        validations: {},
        storefrontAccess: true,
      })
      await setMetafields(tx, storeId, {
        ownerType: 'product',
        ownerId: productId,
        values: { [material.id]: 'PBT plastic', [care.id]: 'Wipe clean' },
      })
    })
    const values = await inStore(storeId, (tx) =>
      loadSourceValues(tx, ['product.metafields.custom.material'], { storeId, productId }),
    )
    expect(values).toEqual({
      'product.metafields.custom.material': { type: 'single_line_text', value: 'PBT plastic' },
    })
  })

  it('reads collection fields, the store and metaobject fields', async () => {
    const { storeId, collectionId } = await seed()
    await inStore(storeId, async (tx) => {
      const def = await createDefinition(tx, storeId, {
        name: 'FAQ',
        type: 'faq',
        displayNameKey: 'question',
        fields: [
          {
            key: 'question',
            name: 'Question',
            type: 'single_line_text',
            list: false,
            required: true,
          },
          { key: 'answer', name: 'Answer', type: 'multi_line_text', list: false, required: false },
        ],
        storefrontAccess: true,
      })
      await createEntry(tx, storeId, {
        definitionId: def.id,
        handle: 'shipping',
        status: 'active',
        fields: { question: 'Shipping?', answer: 'Two days' },
      })
    })
    const values = await inStore(storeId, (tx) =>
      loadSourceValues(
        tx,
        [
          'collection.title',
          'collection.image',
          'collection.url',
          'shop.name',
          'shop.email',
          'metaobjects.faq.shipping.answer',
          'metaobjects.faq.missing.answer',
          'product.title',
        ],
        { storeId, collectionId },
      ),
    )
    expect(values['collection.title']?.value).toBe('Mice')
    expect(values['collection.image']?.value).toEqual({
      url: 'https://cdn.test/viper.jpg',
      alt: 'Mice',
    })
    expect(values['collection.url']?.value).toBe('/collections/mice')
    expect(values['shop.name']?.value).toBe('Store w')
    expect(values['shop.email']?.value).toBe('w@shop.in')
    expect(values['metaobjects.faq.shipping.answer']).toEqual({
      type: 'multi_line_text',
      value: 'Two days',
    })
    // A missing entry and product data without a product are absent: the fallback renders.
    expect(values['metaobjects.faq.missing.answer']).toBeUndefined()
    expect(values['product.title']).toBeUndefined()
  })

  it('never reads another store (RLS)', async () => {
    const a = await seed('a')
    const b = await seed('b')
    const values = await inStore(a.storeId, (tx) =>
      loadSourceValues(tx, ['product.title', 'shop.name'], {
        storeId: b.storeId,
        productId: b.productId,
      }),
    )
    expect(values['product.title']).toBeUndefined()
    expect(values['shop.name']).toBeUndefined()
  })

  it('resolves a template end to end, with fallbacks for empty sources', async () => {
    const { storeId, productId } = await seed()
    const data = {
      root: {},
      content: [
        {
          type: 'ImageBanner',
          props: {
            id: 's1',
            heading: { $source: 'product.title', kind: 'text', fallback: 'Typed' },
            subheading: {
              $source: 'product.metafields.custom.none',
              kind: 'text',
              fallback: 'Kept',
            },
          },
        },
      ],
    }
    const values = await inStore(storeId, (tx) =>
      loadSourceValues(tx, ['product.title', 'product.metafields.custom.none'], {
        storeId,
        productId,
      }),
    )
    const out = applyBindings(data, values)
    expect(out.content[0]?.props.heading).toBe('Viper Mouse')
    expect(out.content[0]?.props.subheading).toBe('Kept')
  })
})

describe('catalog and Save validation', () => {
  it('lists storefront-visible metafields and metaobject entries', async () => {
    const { storeId } = await seed()
    await inStore(storeId, async (tx) => {
      await createMetafieldDefinition(tx, storeId, {
        ownerType: 'product',
        name: 'Material',
        namespace: 'custom',
        type: 'single_line_text',
        list: false,
        validations: {},
        storefrontAccess: true,
      })
      await createMetafieldDefinition(tx, storeId, {
        ownerType: 'product',
        name: 'Supplier',
        namespace: 'custom',
        type: 'single_line_text',
        list: false,
        validations: {},
        storefrontAccess: false,
      })
    })
    const catalog = await inStore(storeId, (tx) => loadSourceCatalog(tx, 'product'))
    const paths = catalog.map((o) => o.path)
    expect(paths).toContain('product.metafields.custom.material')
    expect(paths).not.toContain('product.metafields.custom.supplier')
    expect(paths).toContain('shop.name')
  })

  it('refuses a template connected to a source that does not exist', async () => {
    const { storeId } = await seed()
    const data = {
      root: {},
      content: [
        {
          type: 'RichText',
          props: { id: 'x', heading: { $source: 'product.metafields.custom.gone', kind: 'text' } },
        },
      ],
    }
    const err = await inStore(storeId, (tx) =>
      assertTemplateBindings(tx, [{ template: 'product', data }]),
    ).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(InvalidBindings)
    expect((err as InvalidBindings).problems).toEqual([
      'Rich text › heading is connected to product.metafields.custom.gone, which no longer exists',
    ])
    await expect(
      inStore(storeId, (tx) =>
        assertTemplateBindings(tx, [
          {
            template: 'product',
            data: {
              root: {},
              content: [
                {
                  type: 'RichText',
                  props: { id: 'x', heading: { $source: 'product.title', kind: 'text' } },
                },
              ],
            },
          },
        ]),
      ),
    ).resolves.toBeUndefined()
  })
})
