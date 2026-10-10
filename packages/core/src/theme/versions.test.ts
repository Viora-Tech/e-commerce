/** SOURCE OF TRUTH: theme version history tests (database) — snapshots, retention, listing, preview, restore */
import { createDb, type StoreTx, store, themeTemplate, themeVersion, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { duplicateTheme, ensureMainTheme } from './library'
import { commitTemplateDrafts, loadTemplate, saveTemplateDraft } from './templates'
import type { TemplateData } from './templates-data'
import {
  listThemeVersions,
  restoreThemeVersion,
  snapshotTheme,
  VERSIONS_KEPT,
  versionTemplate,
} from './versions'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

async function seedStore(slug = 's') {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  return s.id
}

const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

const withSections = (...types: string[]): TemplateData => ({
  root: { props: {} },
  content: types.map((type, i) => ({ type, props: { id: `${type}-${i}` } })),
})

const types = (data: TemplateData | null) => data?.content.map((s) => s.type) ?? []

async function saveHome(storeId: string, themeId: string, ...sections: string[]) {
  await inStore(storeId, async (tx) => {
    await saveTemplateDraft(tx, storeId, {
      themeId,
      template: 'home',
      suffix: '',
      data: withSections(...sections),
    })
    await commitTemplateDrafts(tx, themeId)
  })
}

describe('theme version history', () => {
  it('snapshots every saved template as one batch and lists batches newest first', async () => {
    const storeId = await seedStore()
    const main = await inStore(storeId, (tx) => ensureMainTheme(tx, storeId))
    expect(
      await inStore(storeId, (tx) =>
        snapshotTheme(tx, storeId, { themeId: main.id, reason: 'publish' }),
      ),
    ).toBeNull()
    await saveHome(storeId, main.id, 'Hero')
    const first = await inStore(storeId, (tx) =>
      snapshotTheme(tx, storeId, { themeId: main.id, reason: 'publish', by: 'Asha' }),
    )
    await saveHome(storeId, main.id, 'Hero', 'Faq')
    const second = await inStore(storeId, (tx) =>
      snapshotTheme(tx, storeId, { themeId: main.id, reason: 'save' }),
    )
    const list = await inStore(storeId, (tx) => listThemeVersions(tx, main.id))
    expect(list.map((b) => b.batchId)).toEqual([second, first])
    expect(list[1]).toMatchObject({ reason: 'publish', createdBy: 'Asha' })
    expect(list[1]?.templates).toEqual([{ template: 'home', suffix: '' }])
    const old = await inStore(storeId, (tx) =>
      versionTemplate(tx, {
        themeId: main.id,
        batchId: first as string,
        template: 'home',
        suffix: '',
      }),
    )
    expect(types(old)).toEqual(['Hero'])
  })

  it(`keeps only the newest ${VERSIONS_KEPT} per template`, async () => {
    const storeId = await seedStore()
    const main = await inStore(storeId, (tx) => ensureMainTheme(tx, storeId))
    await saveHome(storeId, main.id, 'Hero')
    for (let i = 0; i < VERSIONS_KEPT + 3; i++) {
      await inStore(storeId, (tx) =>
        snapshotTheme(tx, storeId, { themeId: main.id, reason: 'save' }),
      )
    }
    const rows = await inStore(storeId, (tx) =>
      tx.select().from(themeVersion).where(eq(themeVersion.themeId, main.id)),
    )
    expect(rows).toHaveLength(VERSIONS_KEPT)
  })

  it('restores into the drafts only: saved sections and shoppers are untouched', async () => {
    const storeId = await seedStore()
    const main = await inStore(storeId, (tx) => ensureMainTheme(tx, storeId))
    await saveHome(storeId, main.id, 'Hero')
    const batch = (await inStore(storeId, (tx) =>
      snapshotTheme(tx, storeId, { themeId: main.id, reason: 'publish' }),
    )) as string
    await saveHome(storeId, main.id, 'Faq')

    const restored = await inStore(storeId, (tx) =>
      restoreThemeVersion(tx, storeId, { themeId: main.id, batchId: batch }),
    )
    expect(restored).toBe(1)
    const saved = await inStore(storeId, (tx) => loadTemplate(tx, main.id, 'home'))
    const draft = await inStore(storeId, (tx) =>
      loadTemplate(tx, main.id, 'home', '', { withDraft: true }),
    )
    expect(types(saved.data)).toEqual(['Faq'])
    expect(types(draft.data)).toEqual(['Hero'])
    expect(draft.draft).toBe(true)
  })

  it('restores a template the theme no longer has as a draft over the code default', async () => {
    const storeId = await seedStore()
    const main = await inStore(storeId, (tx) => ensureMainTheme(tx, storeId))
    await saveHome(storeId, main.id, 'Hero')
    const batch = (await inStore(storeId, (tx) =>
      snapshotTheme(tx, storeId, { themeId: main.id, reason: 'publish' }),
    )) as string
    await inStore(storeId, (tx) =>
      tx
        .delete(themeTemplate)
        .where(and(eq(themeTemplate.themeId, main.id), eq(themeTemplate.template, 'home'))),
    )
    await inStore(storeId, (tx) =>
      restoreThemeVersion(tx, storeId, { themeId: main.id, batchId: batch }),
    )
    const saved = await inStore(storeId, (tx) => loadTemplate(tx, main.id, 'home'))
    const draft = await inStore(storeId, (tx) =>
      loadTemplate(tx, main.id, 'home', '', { withDraft: true }),
    )
    expect(types(saved.data)).not.toEqual(['Hero'])
    expect(types(draft.data)).toEqual(['Hero'])
  })

  it('never reads or restores another theme’s or another store’s versions', async () => {
    const a = await seedStore('a')
    const b = await seedStore('b')
    const mainA = await inStore(a, (tx) => ensureMainTheme(tx, a))
    const mainB = await inStore(b, (tx) => ensureMainTheme(tx, b))
    await saveHome(b, mainB.id, 'Hero')
    const batchB = (await inStore(b, (tx) =>
      snapshotTheme(tx, b, { themeId: mainB.id, reason: 'publish' }),
    )) as string
    expect(await inStore(a, (tx) => listThemeVersions(tx, mainB.id))).toEqual([])
    await expect(
      inStore(a, (tx) => restoreThemeVersion(tx, a, { themeId: mainA.id, batchId: batchB })),
    ).rejects.toThrow('no longer exists')
    const copy = await inStore(b, (tx) => duplicateTheme(tx, b, mainB.id))
    expect(
      await inStore(b, (tx) =>
        versionTemplate(tx, { themeId: copy.id, batchId: batchB, template: 'home', suffix: '' }),
      ),
    ).toBeNull()
  })
})
