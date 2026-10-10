/** SOURCE OF TRUTH: imported theme storage reads — WHAT: whether a theme is an imported Liquid theme, its import record and report, its renderable bundle (cached per theme version) and single asset files for the storefront's asset route / WHY: every storefront request and every canvas render needs the bundle; reading ~5 MB of theme files per request would be wasteful, so it is cached and re-read only when the import row changes */
import { newId, type StoreTx, themeFile, themeImport } from '@commerce/db'
import { and, eq, like, sql } from 'drizzle-orm'
import { buildThemeBundle, type ThemeBundle } from './bundle'
import type { ImportReport } from './report'

export type ThemeImportRecord = {
  themeId: string
  fileName: string
  themeInfo: { name?: string; version?: string; author?: string; shopifyHost?: string | null }
  settings: Record<string, unknown>
  report: ImportReport
  createdAt: Date
  updatedAt: Date
}

/** The import record of a theme, or null for one of our own themes. */
export async function themeImportFor(
  tx: StoreTx,
  themeId: string,
): Promise<ThemeImportRecord | null> {
  const [row] = await tx.select().from(themeImport).where(eq(themeImport.themeId, themeId))
  if (!row) return null
  return {
    themeId: row.themeId,
    fileName: row.fileName,
    themeInfo: (row.themeInfo ?? {}) as ThemeImportRecord['themeInfo'],
    settings: (row.settings ?? {}) as Record<string, unknown>,
    report: row.report as ImportReport,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/** Which of the store's themes were imported from Shopify (the library shows a badge and the report). */
export async function importedThemeIds(tx: StoreTx): Promise<Set<string>> {
  const rows = await tx.select({ themeId: themeImport.themeId }).from(themeImport)
  return new Set(rows.map((r) => r.themeId))
}

/** How many Liquid sections each imported theme brought (`sections/*.liquid`), by theme id. */
export async function importedSectionCounts(tx: StoreTx): Promise<Map<string, number>> {
  const rows = await tx
    .select({ themeId: themeFile.themeId, n: sql<number>`count(*)::int` })
    .from(themeFile)
    .where(like(themeFile.path, 'sections/%.liquid'))
    .groupBy(themeFile.themeId)
  return new Map(rows.map((r) => [r.themeId, r.n]))
}

const bundles = new Map<string, ThemeBundle>()
const MAX_BUNDLES = 6

/**
 * The renderable bundle for an imported theme (null for our own themes). Text files
 * and checksums are read once per theme version; binary assets stay in the table
 * and are served one at a time by `themeAssetFile`.
 */
export async function loadThemeBundle(tx: StoreTx, themeId: string): Promise<ThemeBundle | null> {
  const record = await themeImportFor(tx, themeId)
  if (!record) return null
  const version = record.updatedAt.toISOString()
  const hit = bundles.get(themeId)
  if (hit && hit.version === version) return hit
  const files = await tx
    .select({
      path: themeFile.path,
      body: themeFile.body,
      encoding: themeFile.encoding,
      checksum: themeFile.checksum,
    })
    .from(themeFile)
    .where(eq(themeFile.themeId, themeId))
  const textFiles = new Map<string, string>()
  const assetChecksums = new Map<string, string>()
  for (const f of files) {
    if (f.encoding === 'utf8') textFiles.set(f.path, f.body)
    if (f.path.startsWith('assets/')) assetChecksums.set(f.path.slice('assets/'.length), f.checksum)
  }
  const bundle = buildThemeBundle({
    themeId,
    version,
    textFiles,
    assetChecksums,
    settings: record.settings,
  })
  bundles.delete(themeId)
  bundles.set(themeId, bundle)
  while (bundles.size > MAX_BUNDLES) {
    const oldest = bundles.keys().next().value
    if (oldest === undefined) break
    bundles.delete(oldest)
  }
  return bundle
}

/** One file of `assets/` for the storefront's asset route. */
export async function themeAssetFile(
  tx: StoreTx,
  themeId: string,
  file: string,
): Promise<{ body: Uint8Array; contentType: string; checksum: string } | null> {
  if (file.includes('..') || file.startsWith('/')) return null
  const [row] = await tx
    .select({
      body: themeFile.body,
      encoding: themeFile.encoding,
      contentType: themeFile.contentType,
      checksum: themeFile.checksum,
    })
    .from(themeFile)
    .where(and(eq(themeFile.themeId, themeId), eq(themeFile.path, `assets/${file}`)))
  if (!row) return null
  const body =
    row.encoding === 'base64'
      ? new Uint8Array(Buffer.from(row.body, 'base64'))
      : new TextEncoder().encode(row.body)
  return { body, contentType: row.contentType, checksum: row.checksum }
}

/** Duplicating an imported theme copies its files and import record, so the copy renders too. */
export async function copyThemeImport(
  tx: StoreTx,
  storeId: string,
  fromThemeId: string,
  toThemeId: string,
): Promise<void> {
  const [record] = await tx.select().from(themeImport).where(eq(themeImport.themeId, fromThemeId))
  if (!record) return
  await tx.insert(themeImport).values({
    ...record,
    id: newId(),
    storeId,
    themeId: toThemeId,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  const files = await tx.select().from(themeFile).where(eq(themeFile.themeId, fromThemeId))
  for (let i = 0; i < files.length; i += 100) {
    await tx
      .insert(themeFile)
      .values(
        files.slice(i, i + 100).map((f) => ({ ...f, id: newId(), storeId, themeId: toThemeId })),
      )
  }
}
