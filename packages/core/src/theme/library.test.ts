import { createDb, newId, type StoreTx, store, theme, themeTemplate, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  createBlankTheme,
  createThemeFromPreset,
  deleteTheme,
  duplicateTheme,
  ensureMainTheme,
  listThemes,
  liveThemeSettings,
  MAX_THEMES,
  publishTheme,
  renameTheme,
  saveThemePacks,
  setThemeThumbnail,
  ThemeLibraryError,
  themePacksOf,
  touchTheme,
  updateThemeSettings,
} from './library'
import { applyThemePreset } from './presets'
import { readThemePreviewToken, signThemePreviewToken } from './preview-token'
import { defaultTheme } from './schema'
import { blankTemplate, defaultTemplate } from './templates-data'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

async function seedStore(legacy?: unknown) {
  const [s] = await owner
    .insert(store)
    .values({ slug: `s${Math.random().toString(36).slice(2, 8)}`, name: 'W', theme: legacy })
    .returning()
  if (!s) throw new Error('seed')
  return s.id
}

const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

describe('theme library', () => {
  it('turns the legacy store theme into the live theme on first use, and reads it back', async () => {
    const minimal = applyThemePreset(defaultTheme, 'minimal')
    const storeId = await seedStore(minimal)

    const live = await inStore(storeId, (tx) => liveThemeSettings(tx, storeId))
    expect(live.preset).toBe('minimal')

    const main = await inStore(storeId, (tx) => ensureMainTheme(tx, storeId))
    expect(main).toMatchObject({ role: 'main', name: 'Minimal', preset: 'minimal' })
    const again = await inStore(storeId, (tx) => ensureMainTheme(tx, storeId))
    expect(again.id).toBe(main.id)
  })

  it('adds, renames, duplicates, publishes and deletes themes, keeping one live theme', async () => {
    const storeId = await seedStore()
    const bold = await inStore(storeId, (tx) =>
      createThemeFromPreset(tx, storeId, { preset: 'bold' }),
    )
    expect(bold).toMatchObject({ role: 'unpublished', name: 'Bold', preset: 'bold' })

    const renamed = await inStore(storeId, (tx) => renameTheme(tx, bold.id, '  Diwali   sale '))
    expect(renamed.name).toBe('Diwali sale')

    const copy = await inStore(storeId, (tx) => duplicateTheme(tx, storeId, bold.id))
    expect(copy).toMatchObject({ role: 'unpublished', name: 'Copy of Diwali sale' })

    await inStore(storeId, (tx) => publishTheme(tx, bold.id))
    const themes = await inStore(storeId, (tx) => listThemes(tx))
    expect(themes.filter((t) => t.role === 'main').map((t) => t.id)).toEqual([bold.id])
    expect(themes[0]?.id).toBe(bold.id)
    const live = await inStore(storeId, (tx) => liveThemeSettings(tx, storeId))
    expect(live.preset).toBe('bold')

    await expect(inStore(storeId, (tx) => deleteTheme(tx, bold.id))).rejects.toBeInstanceOf(
      ThemeLibraryError,
    )
    await inStore(storeId, (tx) => deleteTheme(tx, copy.id))
    expect(await inStore(storeId, (tx) => listThemes(tx))).toHaveLength(2)
  })

  it('validates settings on save and bumps the saved time', async () => {
    const storeId = await seedStore()
    const main = await inStore(storeId, (tx) => ensureMainTheme(tx, storeId))
    const soft = applyThemePreset(main.settings, 'soft')
    const saved = await inStore(storeId, (tx) => updateThemeSettings(tx, main.id, soft))
    expect(saved.preset).toBe('soft')
    expect(saved.updatedAt.getTime()).toBeGreaterThanOrEqual(main.updatedAt.getTime())
    await expect(
      inStore(storeId, (tx) => updateThemeSettings(tx, main.id, { fonts: 'nope' })),
    ).rejects.toThrow()
  })

  it('caps the library and keeps one store out of another', async () => {
    const a = await seedStore()
    const b = await seedStore()
    await inStore(a, async (tx) => {
      await ensureMainTheme(tx, a)
      for (let i = 1; i < MAX_THEMES; i++) await createThemeFromPreset(tx, a, { preset: 'soft' })
    })
    await expect(
      inStore(a, (tx) => createThemeFromPreset(tx, a, { preset: 'soft' })),
    ).rejects.toMatchObject({ code: 'THEME_LIMIT' })
    expect(await inStore(b, (tx) => listThemes(tx))).toEqual([])
  })

  it('refuses two live themes at the database level', async () => {
    const storeId = await seedStore()
    await inStore(storeId, (tx) => ensureMainTheme(tx, storeId))
    await expect(
      owner.insert(theme).values({ storeId, name: 'X', role: 'main', settings: defaultTheme }),
    ).rejects.toThrow()
  })
})

describe('last saved by and thumbnails', () => {
  it('records who saved, keeps it when nobody is named, and copies the picture on duplicate', async () => {
    const storeId = await seedStore()
    const main = await inStore(storeId, (tx) => ensureMainTheme(tx, storeId))
    expect(main).toMatchObject({ updatedBy: null, thumbnailUrl: null })

    const renamed = await inStore(storeId, (tx) => renameTheme(tx, main.id, 'Zero Drift', 'Asha'))
    expect(renamed.updatedBy).toBe('Asha')
    const unnamed = await inStore(storeId, (tx) =>
      updateThemeSettings(tx, main.id, renamed.settings),
    )
    expect(unnamed.updatedBy).toBe('Asha')

    await inStore(storeId, (tx) => setThemeThumbnail(tx, main.id, 'https://cdn.test/t.webp?v=1'))
    const [pictured] = await inStore(storeId, (tx) => listThemes(tx))
    // A picture is not a save: the time and author stay as they were.
    expect(pictured).toMatchObject({
      thumbnailUrl: 'https://cdn.test/t.webp?v=1',
      updatedBy: 'Asha',
    })
    expect(pictured?.updatedAt.getTime()).toBe(unnamed.updatedAt.getTime())

    await inStore(storeId, (tx) => touchTheme(tx, main.id, 'Ravi'))
    const copy = await inStore(storeId, (tx) => duplicateTheme(tx, storeId, main.id, 'Ravi'))
    expect(copy).toMatchObject({ thumbnailUrl: 'https://cdn.test/t.webp?v=1', updatedBy: 'Ravi' })
    const [touched] = await inStore(storeId, (tx) => listThemes(tx))
    expect(touched?.updatedBy).toBe('Ravi')
  })
})

describe('templates of an imported live theme', () => {
  const liquid = (key: string) => ({
    type: 'LiquidSection',
    props: { id: `LiquidSection-${key}`, sectionType: key, sectionKey: key, blocks: [] },
  })
  const ours = { type: 'MainProduct', props: { id: 'main' } }

  async function seedImportedLive(storeId: string) {
    return inStore(storeId, async (tx) => {
      const live = await ensureMainTheme(tx, storeId)
      const row = (template: string, content: unknown[]) => ({
        id: newId(),
        storeId,
        themeId: live.id,
        template,
        sections: { root: { props: {} }, content },
      })
      await tx
        .insert(themeTemplate)
        .values([
          row('home', [liquid('hero'), liquid('featured')]),
          row('product', [ours, liquid('related')]),
          row('page', [{ type: 'RichText', props: { id: 'rich' } }]),
        ])
      return live
    })
  }

  const sectionsOf = (storeId: string, themeId: string) =>
    inStore(storeId, async (tx) => {
      const rows = await tx.select().from(themeTemplate).where(eq(themeTemplate.themeId, themeId))
      return Object.fromEntries(rows.map((r) => [r.template, r.sections]))
    })

  it('a preset theme drops the Shopify sections and falls back to our default', async () => {
    const storeId = await seedStore()
    await seedImportedLive(storeId)
    const minimal = await inStore(storeId, (tx) =>
      createThemeFromPreset(tx, storeId, { preset: 'minimal' }),
    )
    const copied = await sectionsOf(storeId, minimal.id)
    expect(copied.home).toEqual(defaultTemplate('home'))
    expect(copied.product).toEqual({ root: { props: {} }, content: [ours] })
    expect(copied.page).toEqual({
      root: { props: {} },
      content: [{ type: 'RichText', props: { id: 'rich' } }],
    })
  })

  it('a duplicate keeps every section (it gets the files too)', async () => {
    const storeId = await seedStore()
    const live = await seedImportedLive(storeId)
    const copy = await inStore(storeId, (tx) => duplicateTheme(tx, storeId, live.id))
    expect(await sectionsOf(storeId, copy.id)).toEqual(await sectionsOf(storeId, live.id))
  })
})

describe('blank theme (Start from scratch)', () => {
  it('stores empty templates and copies nothing from the live theme', async () => {
    const storeId = await seedStore()
    const live = await inStore(storeId, (tx) => ensureMainTheme(tx, storeId))
    await inStore(storeId, (tx) =>
      tx.insert(themeTemplate).values({
        id: newId(),
        storeId,
        themeId: live.id,
        template: 'page',
        sections: { root: { props: {} }, content: [{ type: 'RichText', props: { id: 'r' } }] },
      }),
    )
    const blank = await inStore(storeId, (tx) => createBlankTheme(tx, storeId, { name: '' }))
    expect(blank).toMatchObject({ role: 'unpublished', name: 'Blank theme', ownPacks: [] })
    const rows = await inStore(storeId, (tx) =>
      tx.select().from(themeTemplate).where(eq(themeTemplate.themeId, blank.id)),
    )
    const byKey = Object.fromEntries(rows.map((r) => [r.template, r.sections]))
    expect(Object.keys(byKey).sort()).toEqual(['footer', 'header', 'home'])
    expect(byKey.home).toEqual(blankTemplate('home'))
    expect(byKey.header).toEqual(blankTemplate('header'))
  })
})

describe('section packs per theme', () => {
  it('follows the store list until the theme has its own, which survives a settings save', async () => {
    const storeId = await seedStore()
    await owner
      .update(store)
      .set({ apps: { installed: [], settings: { core: { themePacks: ['zero-drift'] } } } })
      .where(eq(store.id, storeId))
    const live = await inStore(storeId, (tx) => ensureMainTheme(tx, storeId))
    expect(live.ownPacks).toBeNull()
    expect(await inStore(storeId, (tx) => themePacksOf(tx, storeId, live))).toEqual(['zero-drift'])

    const copy = await inStore(storeId, (tx) => duplicateTheme(tx, storeId, live.id))
    expect(copy.ownPacks).toEqual(['zero-drift'])
    const fresh = await inStore(storeId, (tx) =>
      createThemeFromPreset(tx, storeId, { preset: 'soft' }),
    )
    expect(await inStore(storeId, (tx) => themePacksOf(tx, storeId, fresh))).toEqual([])

    expect(await inStore(storeId, (tx) => saveThemePacks(tx, live.id, []))).toEqual([])
    const saved = await inStore(storeId, (tx) =>
      updateThemeSettings(tx, live.id, applyThemePreset(defaultTheme, 'bold')),
    )
    expect(saved.ownPacks).toEqual([])
    expect(await inStore(storeId, (tx) => themePacksOf(tx, storeId, saved))).toEqual([])
  })
})

describe('preview token', () => {
  const secret = 'test-secret'
  const storeId = '01a0bfee-05a8-76b2-9a94-4587a9a3631a'
  const themeId = '01a0c791-3a1c-75c6-8705-8b8ecb4dedfe'

  it('carries an optional theme id inside the signature', () => {
    const live = signThemePreviewToken({ secret, storeId })
    expect(readThemePreviewToken({ secret, storeId, token: live })).toEqual({ themeId: null })
    const one = signThemePreviewToken({ secret, storeId, themeId })
    expect(readThemePreviewToken({ secret, storeId, token: one })).toEqual({ themeId })
  })

  it('rejects a swapped theme id, another store, and expiry', () => {
    const one = signThemePreviewToken({ secret, storeId, themeId })
    const [exp, , sig] = one.split('.')
    const swapped = `${exp}.01a0c791-3a1c-75c6-8705-000000000000.${sig}`
    expect(readThemePreviewToken({ secret, storeId, token: swapped })).toBeNull()
    expect(readThemePreviewToken({ secret, storeId: themeId, token: one })).toBeNull()
    expect(
      readThemePreviewToken({ secret, storeId, token: one, now: Date.now() + 2 * 3600_000 }),
    ).toBeNull()
  })
})
