/** SOURCE OF TRUTH: CMS PR2 field types against the database — references to pages, variants and blog posts, group files, the type lock, storefront resolution and dynamic source bindings */
import {
  article,
  blog,
  createDb,
  media,
  page,
  product,
  type StoreTx,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { applyBindings } from '../dynamic-sources/resolve'
import { loadSourceCatalog, loadSourceValues } from '../dynamic-sources/service'
import { referenceOptions } from './references'
import { InvalidMetaobject, type MetaobjectDefinitionWrite } from './schemas'
import { createDefinition, createEntry, updateDefinition } from './service'
import { metaobjectByHandle } from './storefront'

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

async function seed(slug: string) {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, title: 'Linen shirt', handle: 'linen-shirt', status: 'active' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p?.id as string, title: 'Blue / M', pricePaise: 149900 })
    .returning()
  const [pg] = await owner
    .insert(page)
    .values({
      storeId: s.id,
      title: 'Size chart',
      handle: 'size-chart',
      data: {},
      publishedAt: new Date(),
    })
    .returning()
  const [draftPage] = await owner
    .insert(page)
    .values({ storeId: s.id, title: 'Hidden', handle: 'hidden', data: {} })
    .returning()
  const [b] = await owner
    .insert(blog)
    .values({ storeId: s.id, title: 'Journal', handle: 'journal' })
    .returning()
  const [a] = await owner
    .insert(article)
    .values({
      storeId: s.id,
      blogId: b?.id as string,
      title: 'How to wash linen',
      handle: 'wash-linen',
      status: 'published',
      publishedAt: new Date(Date.now() - 60_000),
    })
    .returning()
  const [m] = await owner
    .insert(media)
    .values({ storeId: s.id, url: 'https://cdn/x.png', alt: 'Front' })
    .returning()
  return {
    storeId: s.id,
    variantId: v?.id as string,
    pageId: pg?.id as string,
    draftPageId: draftPage?.id as string,
    articleId: a?.id as string,
    mediaId: m?.id as string,
  }
}

const lookbook: MetaobjectDefinitionWrite = {
  name: 'Lookbook',
  type: 'lookbook',
  displayNameKey: 'title',
  storefrontAccess: true,
  fields: [
    { key: 'title', name: 'Title', type: 'single_line_text', list: false, required: true },
    { key: 'accent', name: 'Accent', type: 'color', list: false, required: false },
    { key: 'launch', name: 'Launch', type: 'date_time', list: false, required: false },
    { key: 'price', name: 'Price', type: 'money', list: false, required: false },
    {
      key: 'fit',
      name: 'Fit',
      type: 'choice',
      list: false,
      required: false,
      validations: { choices: ['Slim', 'Relaxed'] },
    },
    { key: 'cta', name: 'Button', type: 'link', list: false, required: false },
    { key: 'stars', name: 'Stars', type: 'rating', list: false, required: false },
    {
      key: 'weight',
      name: 'Weight',
      type: 'measurement',
      list: false,
      required: false,
      validations: { measure: 'weight' },
    },
    { key: 'guide', name: 'Guide', type: 'page_reference', list: false, required: false },
    { key: 'hero', name: 'Hero', type: 'variant_reference', list: false, required: false },
    { key: 'story', name: 'Story', type: 'article_reference', list: false, required: false },
    {
      key: 'looks',
      name: 'Looks',
      type: 'group',
      list: false,
      required: false,
      validations: {
        subfields: [
          { key: 'caption', name: 'Caption', type: 'single_line_text', required: true },
          { key: 'photo', name: 'Photo', type: 'file', required: false },
        ],
      },
    },
  ],
}

describe('CMS PR2 field types', () => {
  it('saves every new type, resolves references on the storefront and binds them', async () => {
    const r = await seed('w')
    const def = await inStore(r.storeId, (tx) => createDefinition(tx, r.storeId, lookbook))
    await inStore(r.storeId, (tx) =>
      createEntry(tx, r.storeId, {
        definitionId: def.id,
        status: 'active',
        fields: {
          title: 'Summer',
          accent: '#E0B000',
          launch: '2026-10-02T10:00:00+05:30',
          price: { amount: 149900, currency: 'INR' },
          fit: 'Relaxed',
          cta: { label: 'See the chart', url: '/pages/size-chart' },
          stars: 4.5,
          weight: { value: '0.4', unit: 'kg' },
          guide: r.pageId,
          hero: r.variantId,
          story: r.articleId,
          looks: [{ caption: 'Beach', photo: r.mediaId }, { caption: '' }],
        },
      }),
    )
    const entry = await inStore(r.storeId, (tx) => metaobjectByHandle({ tx }, 'lookbook', 'summer'))
    expect(entry?.fields).toMatchObject({
      accent: '#e0b000',
      launch: '2026-10-02T04:30:00.000Z',
      price: { amount: 149900, currency: 'INR' },
      stars: { value: 4.5, max: 5 },
      weight: { value: 0.4, unit: 'kg' },
      guide: { handle: 'size-chart', title: 'Size chart' },
      hero: { id: r.variantId, productHandle: 'linen-shirt', title: 'Blue / M', price: 149900 },
      story: { handle: 'wash-linen', blogHandle: 'journal' },
      looks: [{ caption: 'Beach', photo: { url: 'https://cdn/x.png', alt: 'Front' } }],
    })

    const path = (key: string) => `metaobjects.lookbook.summer.${key}`
    const catalog = await inStore(r.storeId, (tx) => loadSourceCatalog(tx, 'index'))
    const offered = catalog
      .filter((o) => o.path.startsWith('metaobjects.lookbook'))
      .map((o) => o.path)
    expect(offered).toContain(path('accent'))
    expect(offered).toContain(path('story'))
    expect(offered).not.toContain(path('looks'))

    const keys = [
      'accent',
      'launch',
      'price',
      'fit',
      'cta',
      'stars',
      'weight',
      'guide',
      'hero',
      'story',
    ]
    const values = await inStore(r.storeId, (tx) =>
      loadSourceValues(tx, keys.map(path), { storeId: r.storeId }),
    )
    const bound = applyBindings(
      {
        color: { $source: path('accent'), kind: 'color' },
        launch: { $source: path('launch'), kind: 'text' },
        price: { $source: path('price'), kind: 'text' },
        fit: { $source: path('fit'), kind: 'text' },
        cta: { $source: path('cta'), kind: 'link', fallback: { label: 'Typed', href: '/' } },
        stars: { $source: path('stars'), kind: 'number' },
        starsText: { $source: path('stars'), kind: 'text' },
        weight: { $source: path('weight'), kind: 'text' },
        guide: { $source: path('guide'), kind: 'url' },
        hero: { $source: path('hero'), kind: 'link', fallback: { label: '', href: '/' } },
        story: { $source: path('story'), kind: 'url' },
      },
      values,
    )
    expect(bound).toEqual({
      color: '#e0b000',
      launch: '2 October 2026 at 10:00 am',
      price: '₹1,499',
      fit: 'Relaxed',
      cta: { label: 'See the chart', href: '/pages/size-chart' },
      stars: 4.5,
      starsText: '4.5/5',
      weight: '0.4 kg',
      guide: '/pages/size-chart',
      hero: { label: 'Linen shirt', href: `/products/linen-shirt?variant=${r.variantId}` },
      story: '/blogs/journal/wash-linen',
    })
  })

  it('refuses references to records that are gone or in another store, and hides drafts', async () => {
    const a = await seed('a')
    const b = await seed('b')
    const def = await inStore(a.storeId, (tx) => createDefinition(tx, a.storeId, lookbook))
    for (const [key, id] of [
      ['guide', b.pageId],
      ['hero', b.variantId],
      ['story', b.articleId],
    ] as const) {
      const err = await inStore(a.storeId, (tx) =>
        createEntry(tx, a.storeId, {
          definitionId: def.id,
          status: 'active',
          fields: { title: 'X', [key]: id },
        }),
      ).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(InvalidMetaobject)
      expect((err as InvalidMetaobject).fieldErrors[key]).toMatch(/deleted/)
    }
    const groupErr = await inStore(a.storeId, (tx) =>
      createEntry(tx, a.storeId, {
        definitionId: def.id,
        status: 'active',
        fields: { title: 'X', looks: [{ caption: 'c', photo: b.mediaId }] },
      }),
    ).catch((e: unknown) => e)
    expect((groupErr as InvalidMetaobject).fieldErrors.looks).toMatch(/file that was deleted/)

    await inStore(a.storeId, (tx) =>
      createEntry(tx, a.storeId, {
        definitionId: def.id,
        status: 'active',
        fields: { title: 'Draft link', guide: a.draftPageId },
      }),
    )
    const entry = await inStore(a.storeId, (tx) =>
      metaobjectByHandle({ tx }, 'lookbook', 'draft-link'),
    )
    expect(entry?.fields.guide).toBeNull()
  })

  it('offers pages, variants and blog posts in the picker', async () => {
    const r = await seed('w')
    const [pages, variants, articles] = await inStore(r.storeId, (tx) =>
      Promise.all([
        referenceOptions(tx, { kind: 'page', query: 'size' }),
        referenceOptions(tx, { kind: 'variant', query: 'linen' }),
        referenceOptions(tx, { kind: 'article', ids: [r.articleId] }),
      ]),
    )
    expect(pages.map((o) => [o.label, o.detail])).toEqual([['Size chart', '/pages/size-chart']])
    expect(variants.map((o) => o.label)).toEqual(['Linen shirt · Blue / M'])
    expect(articles.map((o) => [o.label, o.detail])).toEqual([['How to wash linen', 'Journal']])
  })

  it('locks what goes in a field once entries hold a value in it', async () => {
    const r = await seed('w')
    const def = await inStore(r.storeId, (tx) => createDefinition(tx, r.storeId, lookbook))
    await inStore(r.storeId, (tx) =>
      createEntry(tx, r.storeId, {
        definitionId: def.id,
        status: 'active',
        fields: { title: 'Summer', fit: 'Slim' },
      }),
    )
    const retype = (key: string, change: object) => ({
      ...lookbook,
      fields: lookbook.fields.map((f) => (f.key === key ? { ...f, ...change } : f)),
    })
    const err = await inStore(r.storeId, (tx) =>
      updateDefinition(tx, def.id, retype('fit', { type: 'single_line_text', validations: {} })),
    ).catch((e: unknown) => e)
    expect((err as Error).message).toMatch(/Fit already has values in 1 entry/)
    // An empty field may change; renaming a filled one is fine.
    await inStore(r.storeId, (tx) =>
      updateDefinition(tx, def.id, retype('accent', { type: 'single_line_text' })),
    )
    await inStore(r.storeId, (tx) => updateDefinition(tx, def.id, retype('fit', { name: 'Cut' })))
    // Removed, then added back: allowed while the old values still fit.
    const without = { ...lookbook, fields: lookbook.fields.filter((f) => f.key !== 'fit') }
    await inStore(r.storeId, (tx) => updateDefinition(tx, def.id, without))
    await inStore(r.storeId, (tx) => updateDefinition(tx, def.id, lookbook))
    await inStore(r.storeId, (tx) => updateDefinition(tx, def.id, without))
    const back = await inStore(r.storeId, (tx) =>
      updateDefinition(tx, def.id, {
        ...without,
        fields: [
          ...without.fields,
          { key: 'fit', name: 'Fit', type: 'number_integer', list: false, required: false },
        ],
      }),
    ).catch((e: unknown) => e)
    expect((back as Error).message).toMatch(/still hold old values under the key fit/)
  })
})
