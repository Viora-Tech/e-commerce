import { blog, createDb, product, type StoreTx, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { ensureMainTheme, ThemeLibraryError } from './library'
import { templateAssignments } from './template-assignments'
import {
  createTemplateAlternate,
  deleteTemplateAlternate,
  listTemplates,
  renameTemplateAlternate,
} from './templates'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

async function seedStore() {
  const [s] = await owner
    .insert(store)
    .values({ slug: `s${Math.random().toString(36).slice(2, 8)}`, name: 'W' })
    .returning()
  if (!s) throw new Error('seed')
  return s.id
}

const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

describe('template assignments and the picker manager', () => {
  it('counts resources per alternate and moves them when the alternate is renamed', async () => {
    const storeId = await seedStore()
    const main = await inStore(storeId, (tx) => ensureMainTheme(tx, storeId))
    await inStore(storeId, async (tx) => {
      await createTemplateAlternate(tx, storeId, {
        themeId: main.id,
        template: 'product',
        suffix: 'preorder',
      })
      await createTemplateAlternate(tx, storeId, {
        themeId: main.id,
        template: 'blog',
        suffix: 'news',
      })
      await tx.insert(product).values([
        { storeId, handle: 'a', title: 'A', templateSuffix: 'preorder' },
        { storeId, handle: 'b', title: 'B', templateSuffix: 'preorder' },
        { storeId, handle: 'c', title: 'C' },
      ])
      await tx
        .insert(blog)
        .values({ storeId, handle: 'journal', title: 'J', templateSuffix: 'news' })
    })

    const before = await inStore(storeId, (tx) => templateAssignments(tx))
    expect(before.product).toEqual({ preorder: 2 })
    expect(before.blog).toEqual({ news: 1 })
    expect(before.article).toEqual({})

    const moved = await inStore(storeId, (tx) =>
      renameTemplateAlternate(tx, {
        themeId: main.id,
        template: 'product',
        from: 'preorder',
        to: 'pre-order',
      }),
    )
    expect(moved).toBe(2)
    const after = await inStore(storeId, (tx) => templateAssignments(tx))
    expect(after.product).toEqual({ 'pre-order': 2 })
    const rows = await inStore(storeId, (tx) => listTemplates(tx, main.id))
    expect(rows.map((r) => `${r.template}.${r.suffix}`)).toContain('product.pre-order')
    expect(rows.map((r) => `${r.template}.${r.suffix}`)).not.toContain('product.preorder')
  })

  it('refuses to rename the default, onto a taken name, or to an invalid name', async () => {
    const storeId = await seedStore()
    const main = await inStore(storeId, (tx) => ensureMainTheme(tx, storeId))
    await inStore(storeId, async (tx) => {
      await createTemplateAlternate(tx, storeId, {
        themeId: main.id,
        template: 'page',
        suffix: 'a',
      })
      await createTemplateAlternate(tx, storeId, {
        themeId: main.id,
        template: 'page',
        suffix: 'b',
      })
    })
    const rename = (from: string, to: string) =>
      inStore(storeId, (tx) =>
        renameTemplateAlternate(tx, { themeId: main.id, template: 'page', from, to }),
      )
    await expect(rename('', 'x')).rejects.toBeInstanceOf(ThemeLibraryError)
    await expect(rename('a', 'b')).rejects.toThrow('already exists')
    await expect(rename('a', 'Not Valid')).rejects.toBeInstanceOf(ThemeLibraryError)
    await expect(rename('missing', 'c')).rejects.toThrow('no longer exists')
  })

  it('leaves resources on a deleted alternate (they render the default until reassigned)', async () => {
    const storeId = await seedStore()
    const main = await inStore(storeId, (tx) => ensureMainTheme(tx, storeId))
    await inStore(storeId, async (tx) => {
      await createTemplateAlternate(tx, storeId, {
        themeId: main.id,
        template: 'product',
        suffix: 'gift',
      })
      await tx.insert(product).values({ storeId, handle: 'g', title: 'G', templateSuffix: 'gift' })
      await deleteTemplateAlternate(tx, { themeId: main.id, template: 'product', suffix: 'gift' })
    })
    const [row] = await inStore(storeId, (tx) =>
      tx.select().from(product).where(eq(product.handle, 'g')),
    )
    expect(row?.templateSuffix).toBe('gift')
  })
})
