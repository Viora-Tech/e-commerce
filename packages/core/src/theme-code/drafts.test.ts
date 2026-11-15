/** SOURCE OF TRUTH: one publish for an imported theme's drafts (database) — counts both kinds, puts code and templates live together, one version entry, a broken file stops both */
import { createDb, type StoreTx, store, themeFile, themeTemplate, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { MemoryStorageProvider } from '@commerce/storage'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { fixtureThemeZip } from '../../test/theme-import-fixture'
import { ensureMainTheme, publishTheme } from '../theme/library'
import { saveTemplateDraft } from '../theme/templates'
import type { TemplateData } from '../theme/templates-data'
import { listThemeVersions } from '../theme/versions'
import { importShopifyTheme } from '../theme-import/import'
import { publishThemeDrafts, themeDraftCounts } from './drafts'
import { saveCodeFile } from './files'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

const home = (...types: string[]): TemplateData => ({
  root: { props: {} },
  content: types.map((type, i) => ({ type, props: { id: `${type}-${i}` } })),
})

async function importFixture() {
  const [s] = await owner.insert(store).values({ slug: 's', name: 'Waimers' }).returning()
  if (!s) throw new Error('seed')
  const storeId = s.id
  await inStore(storeId, (tx) => ensureMainTheme(tx, storeId))
  const { themeId } = await inStore(storeId, (tx) =>
    importShopifyTheme(
      tx,
      storeId,
      { zip: fixtureThemeZip(), fileName: 'fixture.zip' },
      { storage: new MemoryStorageProvider() },
    ),
  )
  return { storeId, themeId }
}

/** One unpublished file in Edit code and one template draft in Customize. */
async function editBoth(storeId: string, themeId: string, badge: string) {
  await inStore(storeId, async (tx) => {
    await saveCodeFile(tx, storeId, { themeId, path: 'snippets/badge.liquid', body: badge })
    await saveTemplateDraft(tx, storeId, {
      themeId,
      template: 'home',
      suffix: '',
      data: home('Hero', 'Faq'),
    })
  })
}

const liveBadge = (storeId: string, themeId: string) =>
  inStore(storeId, async (tx) => {
    const [row] = await tx
      .select({ body: themeFile.body, draft: themeFile.draftBody })
      .from(themeFile)
      .where(and(eq(themeFile.themeId, themeId), eq(themeFile.path, 'snippets/badge.liquid')))
    return row
  })

describe('publishThemeDrafts', () => {
  it('counts both kinds of drafts and puts them live together with one version entry', async () => {
    const { storeId, themeId } = await importFixture()
    await inStore(storeId, (tx) => publishTheme(tx, themeId))
    const before = (await inStore(storeId, (tx) => listThemeVersions(tx, themeId))).length
    await editBoth(storeId, themeId, '<strong>{{ text }}</strong>')
    expect(await inStore(storeId, (tx) => themeDraftCounts(tx, themeId))).toEqual({
      templates: 1,
      code: 1,
    })

    const result = await inStore(storeId, (tx) =>
      publishThemeDrafts(tx, storeId, { themeId, by: 'Asha' }),
    )

    expect(result).toMatchObject({ saved: 1, published: 1 })
    expect(result.versionId).not.toBeNull()
    expect(await inStore(storeId, (tx) => themeDraftCounts(tx, themeId))).toEqual({
      templates: 0,
      code: 0,
    })
    expect(await liveBadge(storeId, themeId)).toEqual({
      body: '<strong>{{ text }}</strong>',
      draft: null,
    })
    const versions = await inStore(storeId, (tx) => listThemeVersions(tx, themeId))
    expect(versions).toHaveLength(before + 1)
    expect(versions[0]).toMatchObject({ batchId: result.versionId, createdBy: 'Asha' })
  })

  it('adds no version for a theme that is not live, and nothing when there are no drafts', async () => {
    const { storeId, themeId } = await importFixture()
    await editBoth(storeId, themeId, '<b>{{ text }}</b>')
    const first = await inStore(storeId, (tx) => publishThemeDrafts(tx, storeId, { themeId }))
    expect(first).toEqual({ saved: 1, published: 1, versionId: null })
    expect(await inStore(storeId, (tx) => listThemeVersions(tx, themeId))).toEqual([])
    const again = await inStore(storeId, (tx) => publishThemeDrafts(tx, storeId, { themeId }))
    expect(again).toEqual({ saved: 0, published: 0, versionId: null })
  })

  it('a file that fails its check stops the templates going live too', async () => {
    const { storeId, themeId } = await importFixture()
    await editBoth(storeId, themeId, '<i>{{ text }}</i>')
    // A draft that broke after it was saved (written straight to the row, past the save check).
    await owner
      .update(themeFile)
      .set({ draftBody: '{% if %}' })
      .where(and(eq(themeFile.themeId, themeId), eq(themeFile.path, 'snippets/badge.liquid')))

    await expect(
      inStore(storeId, (tx) => publishThemeDrafts(tx, storeId, { themeId })),
    ).rejects.toThrow(/snippets\/badge\.liquid/)

    const [draft] = await owner
      .select({ draft: themeTemplate.draft })
      .from(themeTemplate)
      .where(and(eq(themeTemplate.themeId, themeId), eq(themeTemplate.template, 'home')))
    expect(draft?.draft).not.toBeNull()
  })
})
