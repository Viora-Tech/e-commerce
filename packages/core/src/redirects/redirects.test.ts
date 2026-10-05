import { createDb, store, urlRedirect, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { builtInRedirect, normaliseRedirectPath, RedirectWriteSchema, withQuery } from './paths'
import {
  DuplicateRedirect,
  deleteRedirects,
  findRedirect,
  hasRedirects,
  importRedirect,
  listRedirects,
  saveRedirect,
  upsertImportedRedirect,
} from './service'

describe('redirect paths', () => {
  it('normalises case, trailing slashes, queries and absolute URLs', () => {
    expect(normaliseRedirectPath('/Products/Old-Tee/?utm=x')).toBe('/products/old-tee')
    expect(normaliseRedirectPath('products/tee')).toBe('/products/tee')
    expect(normaliseRedirectPath('https://shop.example.com/pages/About#x')).toBe('/pages/about')
    expect(normaliseRedirectPath('//a//b/')).toBe('/a/b')
    expect(normaliseRedirectPath('/collections/t%C3%A9')).toBe('/collections/té')
  })

  it('validates writes and refuses a redirect to itself', () => {
    expect(RedirectWriteSchema.safeParse({ path: '/a', target: '/b' }).data).toEqual({
      path: '/a',
      target: '/b',
    })
    expect(RedirectWriteSchema.safeParse({ path: '/A/', target: '/a' }).success).toBe(false)
    expect(RedirectWriteSchema.safeParse({ path: '/', target: '/b' }).success).toBe(false)
    expect(RedirectWriteSchema.safeParse({ path: '/-s/x', target: '/b' }).success).toBe(false)
    expect(RedirectWriteSchema.safeParse({ path: '/a', target: 'https://x.test/y' }).success).toBe(
      true,
    )
  })

  it('answers Shopify URL shapes with a built-in redirect', () => {
    expect(builtInRedirect('/collections/mice/products/viper')).toBe('/products/viper')
    expect(builtInRedirect('/collections/all/products/viper/')).toBe('/products/viper')
    expect(builtInRedirect('/blogs/news/tagged/launch')).toBe('/blogs/news')
    expect(builtInRedirect('/products/viper')).toBeNull()
  })

  it('carries the query string only when the target has none', () => {
    expect(withQuery('/b', '?utm=1')).toBe('/b?utm=1')
    expect(withQuery('/b?x=1', '?utm=1')).toBe('/b?x=1')
    expect(withQuery('/b', '')).toBe('/b')
  })
})

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seedStore(slug: string) {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  return s.id
}

describe('redirect service', () => {
  it('saves, finds, lists, refuses duplicates and deletes', async () => {
    const storeId = await seedStore('r')
    await withStore(app, storeId, async (tx) => {
      expect(await hasRedirects(tx)).toBe(false)
      const row = await saveRedirect(tx, storeId, { path: '/old', target: '/new' })
      expect(await hasRedirects(tx)).toBe(true)
      expect(await findRedirect(tx, '/OLD/')).toBe('/new')
      await expect(saveRedirect(tx, storeId, { path: '/old', target: '/x' })).rejects.toThrow(
        DuplicateRedirect,
      )
      await saveRedirect(tx, storeId, { id: row.id, path: '/old', target: '/newer' })
      expect(await findRedirect(tx, '/old')).toBe('/newer')
      await saveRedirect(tx, storeId, { path: '/pages/faq', target: '/pages/help' })
      const listed = await listRedirects(tx, { page: 1, perPage: 10, query: 'faq' })
      expect(listed.total).toBe(1)
      expect(await deleteRedirects(tx, [row.id])).toBe(1)
      expect(await findRedirect(tx, '/old')).toBeNull()
    })
  })

  it('never lets an import overwrite a manual redirect', async () => {
    const storeId = await seedStore('r2')
    await withStore(app, storeId, async (tx) => {
      await saveRedirect(tx, storeId, { path: '/sale', target: '/collections/sale' })
      expect(await upsertImportedRedirect(tx, storeId, '/sale', '/elsewhere')).toBe('skipped')
      expect(await upsertImportedRedirect(tx, storeId, '/Old-Page', '/pages/new')).toBe('created')
      expect(await upsertImportedRedirect(tx, storeId, '/old-page', '/pages/new')).toBe('skipped')
      expect(await upsertImportedRedirect(tx, storeId, '/old-page', '/pages/newer')).toBe('updated')
      expect(await findRedirect(tx, '/sale')).toBe('/collections/sale')
      // Why each skip happened, for the import's report.
      expect(await importRedirect(tx, storeId, '/sale', '/x')).toEqual({
        outcome: 'skipped',
        skip: 'manual',
      })
      expect(await importRedirect(tx, storeId, '/old-page', '/pages/newer')).toEqual({
        outcome: 'skipped',
        skip: 'unchanged',
      })
      expect(await importRedirect(tx, storeId, '/', '/x')).toEqual({
        outcome: 'skipped',
        skip: 'invalid',
      })
    })
  })

  it('keeps redirects per store', async () => {
    const a = await seedStore('a')
    const b = await seedStore('b')
    await withStore(app, a, (tx) => saveRedirect(tx, a, { path: '/x', target: '/y' }))
    const inB = await withStore(app, b, (tx) => findRedirect(tx, '/x'))
    expect(inB).toBeNull()
    const all = await owner.select().from(urlRedirect)
    expect(all).toHaveLength(1)
  })
})
