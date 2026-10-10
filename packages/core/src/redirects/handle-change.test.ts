/** SOURCE OF TRUTH: tests for redirects and menus following a handle change, the menu link check and the redirects CSV import (CMS PR5) */
import {
  article,
  blog,
  collection,
  createDb,
  type NavigationItem,
  navigationMenu,
  page,
  product,
  type StoreTx,
  store,
  urlRedirect,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { asc, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createProduct, updateProduct } from '../catalog/products'
import type { ProductWrite } from '../catalog/schemas'
import { createCollection, updateCollection } from '../collections/service'
import { menuLinkProblems } from '../navigation/link-check'
import { parseRedirectsCsv } from './csv'
import { onHandleChange } from './handle-change'
import { importRedirectsCsv, saveRedirect } from './service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seedStore(slug = 'w') {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  return s?.id as string
}

const run = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

const pad: ProductWrite = {
  title: 'Shion Glasspad',
  status: 'active',
  tags: [],
  options: [],
  variants: [{ optionValues: [], pricePaise: 499900 }],
}

const redirects = () =>
  owner
    .select({ path: urlRedirect.path, target: urlRedirect.target, source: urlRedirect.source })
    .from(urlRedirect)
    .orderBy(asc(urlRedirect.path))

const link = (id: string, type: NavigationItem['type'], value?: string): NavigationItem => ({
  id,
  title: id,
  type,
  ...(value === undefined ? {} : { value }),
})

describe('a handle change', () => {
  it('leaves a redirect behind and moves menu links when a product is renamed', async () => {
    const s = await seedStore()
    const id = await run(s, (tx) => createProduct(tx, s, pad))
    await owner.insert(navigationMenu).values({
      storeId: s,
      title: 'Main',
      handle: 'main-menu',
      items: [
        link('a', 'product', 'shion-glasspad'),
        { ...link('b', 'home'), children: [link('c', 'product', 'shion-glasspad')] },
        link('d', 'collection', 'shion-glasspad'),
      ],
    })
    await run(s, (tx) => updateProduct(tx, s, id, { ...pad, handle: 'shion-pad-v2' }))

    expect(await redirects()).toEqual([
      { path: '/products/shion-glasspad', target: '/products/shion-pad-v2', source: 'auto' },
    ])
    const [menu] = await owner.select().from(navigationMenu)
    expect(menu?.items[0]?.value).toBe('shion-pad-v2')
    expect(menu?.items[1]?.children?.[0]?.value).toBe('shion-pad-v2')
    // A collection with the same handle is a different thing.
    expect(menu?.items[2]?.value).toBe('shion-glasspad')
  })

  it('does nothing when the handle stays the same', async () => {
    const s = await seedStore()
    const id = await run(s, (tx) => createProduct(tx, s, pad))
    await run(s, (tx) => updateProduct(tx, s, id, { ...pad, title: 'Renamed only' }))
    await run(s, (tx) => updateProduct(tx, s, id, { ...pad, handle: 'shion-glasspad' }))
    expect(await redirects()).toEqual([])
  })

  it('flattens chains, frees the new path and survives renaming back', async () => {
    const s = await seedStore()
    await run(s, (tx) => saveRedirect(tx, s, { path: '/products/ancient', target: '/products/a' }))
    await run(s, (tx) => onHandleChange(tx, s, 'product', 'a', 'b'))
    expect(await redirects()).toEqual([
      { path: '/products/a', target: '/products/b', source: 'auto' },
      { path: '/products/ancient', target: '/products/b', source: 'manual' },
    ])
    // Renamed back: /products/a is live again, so its redirect goes; b now points at a.
    await run(s, (tx) => onHandleChange(tx, s, 'product', 'b', 'a'))
    expect(await redirects()).toEqual([
      { path: '/products/ancient', target: '/products/a', source: 'manual' },
      { path: '/products/b', target: '/products/a', source: 'auto' },
    ])
  })

  it('works for collections too, and only touches this store', async () => {
    const s = await seedStore('a')
    const other = await seedStore('b')
    await owner
      .insert(urlRedirect)
      .values({ storeId: other, path: '/collections/old-name', target: '/x', source: 'manual' })
    const id = await run(s, (tx) =>
      createCollection(tx, s, { title: 'Old name', kind: 'manual', productIds: [] }),
    )
    await run(s, (tx) =>
      updateCollection(tx, s, id, {
        title: 'Old name',
        kind: 'manual',
        handle: 'new-name',
        productIds: [],
      }),
    )
    const rows = await owner.select().from(urlRedirect).orderBy(asc(urlRedirect.storeId))
    expect(rows.filter((r) => r.storeId === s).map((r) => [r.path, r.target])).toEqual([
      ['/collections/old-name', '/collections/new-name'],
    ])
    expect(rows.filter((r) => r.storeId === other).map((r) => r.target)).toEqual(['/x'])
    const [c] = await owner.select().from(collection).where(eq(collection.id, id))
    expect(c?.handle).toBe('new-name')
  })
})

describe('menuLinkProblems', () => {
  async function seedContent(s: string) {
    await owner.insert(product).values([
      { storeId: s, title: 'Live', handle: 'live', status: 'active' },
      { storeId: s, title: 'Draft', handle: 'draft', status: 'draft' },
    ])
    await owner.insert(collection).values([
      { storeId: s, title: 'Sale', handle: 'sale', status: 'active' },
      { storeId: s, title: 'Soon', handle: 'soon', status: 'draft' },
    ])
    const layout = { root: { props: {} }, content: [] }
    await owner.insert(page).values([
      { storeId: s, title: 'About', handle: 'about', data: layout, publishedAt: new Date() },
      { storeId: s, title: 'Hidden', handle: 'hidden', data: layout },
      {
        storeId: s,
        title: 'Refunds',
        handle: 'refund-policy',
        data: layout,
        publishedAt: new Date(),
      },
    ])
    const [b] = await owner
      .insert(blog)
      .values({ storeId: s, title: 'News', handle: 'news' })
      .returning()
    await owner.insert(article).values([
      {
        storeId: s,
        blogId: b?.id as string,
        title: 'Out',
        handle: 'out',
        status: 'published',
        publishedAt: new Date(),
      },
      { storeId: s, blogId: b?.id as string, title: 'WIP', handle: 'wip', status: 'draft' },
    ])
  }

  it('finds gone and hidden destinations at every level, typed or typed in as a URL', async () => {
    const s = await seedStore()
    await seedContent(s)
    await owner
      .insert(urlRedirect)
      .values({ storeId: s, path: '/products/gone', target: '/products/live', source: 'auto' })
    const items: NavigationItem[] = [
      link('home', 'home'),
      link('live', 'product', 'live'),
      link('draft', 'product', 'draft'),
      link('gone', 'product', 'gone'),
      {
        ...link('menu', 'collections'),
        children: [
          link('sale', 'collection', 'sale'),
          link('soon', 'collection', 'soon'),
          link('about', 'page', 'about'),
          link('hidden', 'page', 'hidden'),
        ],
      },
      link('blog', 'blog', 'news'),
      link('noblog', 'blog', 'press'),
      link('post', 'article', 'news/out'),
      link('wip', 'article', 'news/wip'),
      link('refund', 'policy', 'refund-policy'),
      link('privacy', 'policy', 'privacy-policy'),
      link('search', 'search'),
      link('typed', 'url', '/products/nope'),
      link('typed-ok', 'url', '/Collections/Sale/'),
      link('all', 'url', '/collections/all'),
      link('outside', 'url', 'https://instagram.com/waimers'),
    ]
    const problems = await run(s, (tx) => menuLinkProblems(tx, items))
    expect(problems.map((p) => [p.itemId, p.problem, p.redirectTo])).toEqual([
      ['draft', 'hidden', undefined],
      ['gone', 'missing', '/products/live'],
      ['soon', 'hidden', undefined],
      ['hidden', 'hidden', undefined],
      ['noblog', 'missing', undefined],
      ['wip', 'hidden', undefined],
      ['privacy', 'missing', undefined],
      ['typed', 'missing', undefined],
    ])
    expect(problems[1]).toMatchObject({ title: 'gone', path: '/products/gone' })
  })

  it('never sees another store’s products', async () => {
    const a = await seedStore('a')
    const b = await seedStore('b')
    await seedContent(b)
    const problems = await run(a, (tx) => menuLinkProblems(tx, [link('x', 'product', 'live')]))
    expect(problems.map((p) => p.problem)).toEqual(['missing'])
  })

  it('has nothing to say about an empty menu', async () => {
    const s = await seedStore()
    expect(await run(s, (tx) => menuLinkProblems(tx, []))).toEqual([])
  })
})

describe('importRedirectsCsv', () => {
  it('adds new paths, updates changed ones as manual and counts the rest', async () => {
    const s = await seedStore()
    await owner.insert(urlRedirect).values([
      { storeId: s, path: '/a', target: '/old', source: 'import' },
      { storeId: s, path: '/b', target: '/same', source: 'auto' },
    ])
    const { rows } = parseRedirectsCsv('Redirect from,Redirect to\n/a,/new\n/b,/same\n/c,/d\n')
    const r = await run(s, (tx) => importRedirectsCsv(tx, s, rows))
    expect(r).toEqual({ created: 1, updated: 1, unchanged: 1 })
    expect(await redirects()).toEqual([
      { path: '/a', target: '/new', source: 'manual' },
      { path: '/b', target: '/same', source: 'auto' },
      { path: '/c', target: '/d', source: 'manual' },
    ])
    expect(await run(s, (tx) => importRedirectsCsv(tx, s, []))).toEqual({
      created: 0,
      updated: 0,
      unchanged: 0,
    })
  })

  it('imports a thousand rows in one go', async () => {
    const s = await seedStore()
    const rows = Array.from({ length: 1200 }, (_, i) => ({ path: `/p/${i}`, target: '/t' }))
    const r = await run(s, (tx) => importRedirectsCsv(tx, s, rows))
    expect(r.created).toBe(1200)
    expect(await redirects()).toHaveLength(1200)
  })
})
