/** SOURCE OF TRUTH: imported-theme draft preview tests — every Edit code draft save previews its own templates, never a parsed copy of an earlier save */
import { type StoreTx, themeFile, themeImport } from '@commerce/db'
import { describe, expect, it } from 'vitest'
import { engineFor, parsed, type ThemeBundle } from './bundle'
import { draftDigest, loadThemeDraftBundle } from './bundle-store'

const THEME_ID = 'theme-draft-preview'
/** Saving a draft never touches the import row, so its `updated_at` stays put across saves. */
const IMPORTED_AT = new Date('2026-11-01T10:00:00Z')

type FileRow = {
  path: string
  body: string
  draftBody: string | null
  encoding: 'utf8' | 'base64'
  checksum: string
}

/** Just enough of a store transaction for `loadThemeDraftBundle`: the import row and the files. */
function fakeTx(files: FileRow[]): StoreTx {
  const importRow = {
    themeId: THEME_ID,
    fileName: 'theme.zip',
    themeInfo: {},
    settings: {},
    report: {},
    createdAt: IMPORTED_AT,
    updatedAt: IMPORTED_AT,
  }
  return {
    select: () => ({
      from: (table: unknown) => ({
        where: async () => (table === themeImport ? [importRow] : table === themeFile ? files : []),
      }),
    }),
  } as unknown as StoreTx
}

/** Saves a draft of one file, as Edit code does: only `draftBody` changes. */
function saveDraft(files: FileRow[], path: string, body: string) {
  const row = files.find((f) => f.path === path)
  if (row) row.draftBody = body
}

/** Renders a section the way the preview does: through the per-version parsed-template cache. */
function renderSection(bundle: ThemeBundle, name: string): string {
  const entry = engineFor(bundle)
  const section = bundle.sections.get(name)
  if (!section) throw new Error(`no section ${name}`)
  return entry.engine.renderSync(parsed(entry, `sections/${name}`, section.source), {}) as string
}

describe('imported theme draft preview', () => {
  it('previews the second draft save, not the first', async () => {
    const files: FileRow[] = [
      {
        path: 'sections/hero.liquid',
        body: '<h1>Live</h1>',
        draftBody: null,
        encoding: 'utf8',
        checksum: 'c1',
      },
    ]
    const tx = fakeTx(files)

    saveDraft(files, 'sections/hero.liquid', '<h1>First draft</h1>')
    const first = await loadThemeDraftBundle(tx, THEME_ID)
    if (!first) throw new Error('expected a draft bundle')
    expect(renderSection(first, 'hero')).toBe('<h1>First draft</h1>')

    saveDraft(files, 'sections/hero.liquid', '<h1>Second draft</h1>')
    const second = await loadThemeDraftBundle(tx, THEME_ID)
    if (!second) throw new Error('expected a draft bundle')
    expect(second.version).not.toBe(first.version)
    expect(renderSection(second, 'hero')).toBe('<h1>Second draft</h1>')
  })

  it('keeps the same version while the drafts are unchanged, so the cache still helps', () => {
    const a = draftDigest([
      { path: 'b.liquid', draftBody: 'B' },
      { path: 'a.liquid', draftBody: 'A' },
    ])
    const b = draftDigest([
      { path: 'a.liquid', draftBody: 'A' },
      { path: 'b.liquid', draftBody: 'B' },
    ])
    expect(a).toBe(b)
    expect(draftDigest([{ path: 'a.liquid', draftBody: 'A2' }])).not.toBe(
      draftDigest([{ path: 'a.liquid', draftBody: 'A' }]),
    )
  })
})
