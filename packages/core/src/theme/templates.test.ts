import { createDb, type StoreTx, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  createThemeFromPreset,
  duplicateTheme,
  ensureMainTheme,
  ThemeLibraryError,
} from './library'
import {
  commitTemplateDrafts,
  createTemplateAlternate,
  deleteTemplateAlternate,
  discardTemplateDrafts,
  listTemplates,
  loadTemplate,
  saveTemplateDraft,
} from './templates'
import { defaultTemplate, parseTemplateData, type TemplateData } from './templates-data'

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

const withSections = (...types: string[]): TemplateData => ({
  root: { props: {} },
  content: types.map((type, i) => ({ type, props: { id: `${type}-${i}` } })),
})

const types = (data: TemplateData) => data.content.map((s) => s.type)

describe('theme templates', () => {
  it('falls back to code defaults so an untouched store renders as before', async () => {
    const storeId = await seedStore()
    const main = await inStore(storeId, (tx) => ensureMainTheme(tx, storeId))
    const product = await inStore(storeId, (tx) => loadTemplate(tx, main.id, 'product'))
    expect(product).toMatchObject({ stored: false, draft: false, suffix: '' })
    expect(types(product.data)).toEqual(['MainProduct'])
    expect(types(defaultTemplate('header'))).toEqual(['Header'])
  })

  it('keeps edits in a draft that only the preview sees until Save', async () => {
    const storeId = await seedStore()
    const main = await inStore(storeId, (tx) => ensureMainTheme(tx, storeId))
    const edited = withSections('RichText', 'Hero')
    await inStore(storeId, (tx) =>
      saveTemplateDraft(tx, storeId, {
        themeId: main.id,
        template: 'home',
        suffix: '',
        data: edited,
      }),
    )

    const live = await inStore(storeId, (tx) => loadTemplate(tx, main.id, 'home'))
    expect(types(live.data)).toEqual(types(defaultTemplate('home')))
    const preview = await inStore(storeId, (tx) =>
      loadTemplate(tx, main.id, 'home', '', { withDraft: true }),
    )
    expect(preview.draft).toBe(true)
    expect(types(preview.data)).toEqual(['RichText', 'Hero'])

    expect(await inStore(storeId, (tx) => commitTemplateDrafts(tx, main.id))).toBe(1)
    const saved = await inStore(storeId, (tx) => loadTemplate(tx, main.id, 'home'))
    expect(types(saved.data)).toEqual(['RichText', 'Hero'])

    await inStore(storeId, (tx) =>
      saveTemplateDraft(tx, storeId, {
        themeId: main.id,
        template: 'home',
        suffix: '',
        data: withSections('Faq'),
      }),
    )
    await inStore(storeId, (tx) => discardTemplateDrafts(tx, main.id))
    const listed = await inStore(storeId, (tx) => listTemplates(tx, main.id))
    expect(listed).toMatchObject([{ template: 'home', suffix: '', hasDraft: false }])
  })

  it('creates alternates from the default, falls back when one is missing, and deletes them', async () => {
    const storeId = await seedStore()
    const main = await inStore(storeId, (tx) => ensureMainTheme(tx, storeId))
    const alt = await inStore(storeId, (tx) =>
      createTemplateAlternate(tx, storeId, {
        themeId: main.id,
        template: 'product',
        suffix: 'preorder',
      }),
    )
    expect(types(alt.data)).toEqual(['MainProduct'])
    await expect(
      inStore(storeId, (tx) =>
        createTemplateAlternate(tx, storeId, {
          themeId: main.id,
          template: 'product',
          suffix: 'preorder',
        }),
      ),
    ).rejects.toBeInstanceOf(ThemeLibraryError)
    await expect(
      inStore(storeId, (tx) =>
        createTemplateAlternate(tx, storeId, {
          themeId: main.id,
          template: 'product',
          suffix: 'Bad Name',
        }),
      ),
    ).rejects.toBeInstanceOf(ThemeLibraryError)

    const missing = await inStore(storeId, (tx) => loadTemplate(tx, main.id, 'product', 'gone'))
    expect(missing.suffix).toBe('')
    await inStore(storeId, (tx) =>
      deleteTemplateAlternate(tx, { themeId: main.id, template: 'product', suffix: 'preorder' }),
    )
    expect(await inStore(storeId, (tx) => listTemplates(tx, main.id))).toEqual([])
  })

  it('copies saved templates to duplicated and new themes, never drafts', async () => {
    const storeId = await seedStore()
    const main = await inStore(storeId, (tx) => ensureMainTheme(tx, storeId))
    await inStore(storeId, async (tx) => {
      await saveTemplateDraft(tx, storeId, {
        themeId: main.id,
        template: 'home',
        suffix: '',
        data: withSections('Faq'),
      })
      await commitTemplateDrafts(tx, main.id)
      await saveTemplateDraft(tx, storeId, {
        themeId: main.id,
        template: 'home',
        suffix: '',
        data: withSections('Video'),
      })
    })
    const copy = await inStore(storeId, (tx) => duplicateTheme(tx, storeId, main.id))
    const fresh = await inStore(storeId, (tx) =>
      createThemeFromPreset(tx, storeId, { preset: 'bold' }),
    )
    for (const id of [copy.id, fresh.id]) {
      const home = await inStore(storeId, (tx) =>
        loadTemplate(tx, id, 'home', '', { withDraft: true }),
      )
      expect(types(home.data)).toEqual(['Faq'])
    }
  })

  it('ignores malformed sections in stored data', () => {
    expect(
      parseTemplateData({ content: [{ type: 'Hero' }, { type: 'Faq', props: { id: 'f' } }] }),
    ).toMatchObject({ content: [{ type: 'Faq' }] })
    expect(parseTemplateData('nope')).toBeNull()
  })
})
