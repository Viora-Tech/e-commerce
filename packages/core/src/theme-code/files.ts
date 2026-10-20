/** SOURCE OF TRUTH: Edit code on the server — WHAT: a theme's files as Edit code lists, reads, saves and adds them (an imported Shopify theme's own files; a native theme's templates and settings as JSON), and each file's saved versions / WHY: merchants own these files, a save must never let a broken file reach the store, and every save can be compared and undone */
import { createHash } from 'node:crypto'
import {
  newId,
  type StoreTx,
  themeFile,
  themeFileVersion,
  themeImport,
  themeVersion,
} from '@commerce/db'
import { and, desc, eq, sql } from 'drizzle-orm'
import { getTheme, ThemeLibraryError, touchTheme, updateThemeSettings } from '../theme/library'
import { ThemeSchema } from '../theme/schema'
import {
  commitTemplateDraft,
  createTemplateAlternate,
  listTemplates,
  loadTemplate,
  saveTemplateDraft,
} from '../theme/templates'
import {
  parseTemplateData,
  SECTION_GROUPS,
  TEMPLATE_KINDS,
  type TemplateKey,
} from '../theme/templates-data'
import { snapshotTheme } from '../theme/versions'
import { safeThemePath, themeContentType } from '../theme-import/archive'
import { normalizeLiquid } from '../theme-import/bundle'
import { themeImportFor } from '../theme-import/bundle-store'
import { createThemeEngine } from '../theme-import/engine'
import { withoutSchema } from '../theme-import/schema'
import { type CodeProblem, checkCode, checkJson } from './check'
import {
  NATIVE_SETTINGS_PATH,
  NEW_FILE_KINDS,
  NEW_FILE_KINDS_FOR,
  NEW_FILE_NAME,
  type NewFileKind,
  nativeTemplatePath,
  newFileBody,
  parseAlternateName,
  parseNativeTemplatePath,
} from './paths'

/** Saved versions kept per file; older ones go when a new one is taken. */
const CODE_VERSIONS_KEPT = 30

/** An imported theme's files that only fed the import: the theme editor owns what they held. */
const IMPORT_ONLY = /^(templates\/.+\.json|config\/settings_data\.json)$/

export type CodeThemeKind = 'imported' | 'native'

export type CodeFileEntry = {
  path: string
  size: number
  /** Images and fonts: listed, never opened as text. */
  binary: boolean
  /** False for files Edit code shows but does not save (see `readOnlyReason`). */
  editable: boolean
  readOnlyReason: 'binary' | 'import-source' | null
  /** Imported themes: saved in Edit code but not published yet (the store shows the old file). */
  draft: boolean
}

export type CodeFileList = {
  kind: CodeThemeKind
  /** Imported themes: how many files have unpublished saves. */
  drafts: number
  files: CodeFileEntry[]
  /** Native themes: each library section type in use, with the files that use it. */
  libraryUse: Record<string, string[]>
}

export type CodeFile = CodeFileEntry & { body: string }

export type CodeFileVersion = {
  id: string
  /** Native templates: the theme version this belongs to ("Restore whole theme"). */
  batchId: string | null
  reason: 'import' | 'create' | 'save' | 'publish'
  createdBy: string | null
  createdAt: Date
}

export type CodeSaveResult = { path: string; savedAt: Date; draft: boolean }

const invalid = (message: string) => new ThemeLibraryError('THEME_CODE_INVALID', message)

const byteLength = (text: string) => new TextEncoder().encode(text).byteLength

const checksumOf = (text: string) =>
  createHash('sha256').update(new TextEncoder().encode(text)).digest('hex').slice(0, 16)

const prettyJson = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

async function themeKind(tx: StoreTx, themeId: string): Promise<CodeThemeKind> {
  if (!(await getTheme(tx, themeId))) {
    throw new ThemeLibraryError('THEME_NOT_FOUND', `No theme ${themeId}`)
  }
  return (await themeImportFor(tx, themeId)) ? 'imported' : 'native'
}

/** Every template a native theme can show: the stored ones, plus each kind's default. */
async function nativeTemplates(tx: StoreTx, themeId: string) {
  const stored = await listTemplates(tx, themeId)
  const keys = new Map<string, { template: TemplateKey; suffix: string }>()
  for (const template of [...TEMPLATE_KINDS, ...SECTION_GROUPS]) {
    keys.set(nativeTemplatePath(template, ''), { template, suffix: '' })
  }
  for (const t of stored) keys.set(nativeTemplatePath(t.template, t.suffix), t)
  return keys
}

/** The files Edit code lists for a theme, folders first as Shopify orders them. */
export async function listCodeFiles(tx: StoreTx, themeId: string): Promise<CodeFileList> {
  const kind = await themeKind(tx, themeId)
  if (kind === 'imported') {
    const rows = await tx
      .select({
        path: themeFile.path,
        size: themeFile.size,
        encoding: themeFile.encoding,
        draft: sql<boolean>`${themeFile.draftBody} is not null`,
      })
      .from(themeFile)
      .where(eq(themeFile.themeId, themeId))
      .orderBy(themeFile.path)
    return {
      kind,
      drafts: rows.filter((r) => r.draft).length,
      libraryUse: {},
      files: rows.map((r) => {
        const binary = r.encoding !== 'utf8'
        const readOnlyReason = binary ? 'binary' : IMPORT_ONLY.test(r.path) ? 'import-source' : null
        return {
          path: r.path,
          size: r.size,
          binary,
          editable: readOnlyReason === null,
          readOnlyReason,
          draft: r.draft,
        }
      }),
    }
  }
  const templates = await nativeTemplates(tx, themeId)
  const files: CodeFileEntry[] = []
  const libraryUse: Record<string, string[]> = {}
  for (const [path, key] of templates) {
    const loaded = await loadTemplate(tx, themeId, key.template, key.suffix, { withDraft: true })
    for (const section of loaded.data.content) {
      const users = libraryUse[section.type] ?? []
      if (!users.includes(path)) users.push(path)
      libraryUse[section.type] = users
    }
    files.push({
      path,
      size: byteLength(prettyJson(loaded.data)),
      binary: false,
      editable: true,
      readOnlyReason: null,
      draft: false,
    })
  }
  const found = await getTheme(tx, themeId)
  files.push({
    path: NATIVE_SETTINGS_PATH,
    size: byteLength(prettyJson(found?.settings ?? {})),
    binary: false,
    editable: true,
    readOnlyReason: null,
    draft: false,
  })
  return { kind, drafts: 0, files, libraryUse }
}

/** One file's text, as Edit code opens it: with its unpublished save (imported) or draft (native). */
export async function readCodeFile(tx: StoreTx, themeId: string, path: string): Promise<CodeFile> {
  const kind = await themeKind(tx, themeId)
  if (kind === 'imported') {
    const [row] = await tx
      .select()
      .from(themeFile)
      .where(and(eq(themeFile.themeId, themeId), eq(themeFile.path, path)))
    if (!row) throw new ThemeLibraryError('THEME_NOT_FOUND', `No file ${path}`)
    const binary = row.encoding !== 'utf8'
    const readOnlyReason = binary ? 'binary' : IMPORT_ONLY.test(path) ? 'import-source' : null
    const body = row.draftBody ?? row.body
    return {
      path,
      size: binary ? row.size : byteLength(body),
      binary,
      editable: readOnlyReason === null,
      readOnlyReason,
      draft: row.draftBody !== null,
      body: binary ? '' : body,
    }
  }
  if (path === NATIVE_SETTINGS_PATH) {
    const found = await getTheme(tx, themeId)
    const body = prettyJson(found?.settings ?? {})
    return {
      path,
      size: byteLength(body),
      binary: false,
      editable: true,
      readOnlyReason: null,
      draft: false,
      body,
    }
  }
  const key = parseNativeTemplatePath(path)
  if (!key) throw new ThemeLibraryError('THEME_NOT_FOUND', `No file ${path}`)
  const loaded = await loadTemplate(tx, themeId, key.template, key.suffix, { withDraft: true })
  const body = prettyJson(loaded.data)
  return {
    path,
    size: byteLength(body),
    binary: false,
    editable: true,
    readOnlyReason: null,
    draft: false,
    body,
  }
}

/**
 * The problems that stop a save: the same checks as the editor, plus, for Liquid, the theme
 * engine's own parser (what the storefront would fail on). Empty when the file can be saved.
 */
export function codeProblems(path: string, body: string): CodeProblem[] {
  const found = checkCode(path, body)
  if (found.length || !path.endsWith('.liquid')) return found
  try {
    createThemeEngine(new Map()).parse(normalizeLiquid(withoutSchema(body)))
    return []
  } catch (err) {
    const token = (err as { token?: { getPosition?: () => [number, number] } }).token
    const [line, column] = token?.getPosition?.() ?? [1, 1]
    const message = err instanceof Error ? err.message.replace(/, line:\d+, col:\d+$/, '') : ''
    return [{ line, column, message: message || 'This Liquid does not read' }]
  }
}

/** Keeps the newest `CODE_VERSIONS_KEPT` versions of one file. */
async function trimVersions(tx: StoreTx, themeId: string, path: string) {
  await tx.execute(sql`
    delete from ${themeFileVersion} where ${themeFileVersion.id} in (
      select id from (
        select id, row_number() over (order by created_at desc, id desc) as n
        from ${themeFileVersion}
        where ${themeFileVersion.themeId} = ${themeId} and ${themeFileVersion.path} = ${path}
      ) ranked where n > ${CODE_VERSIONS_KEPT}
    )`)
}

/**
 * Saves an imported theme's file as a draft: the store keeps showing the published file until
 * Publish (`publishCodeDrafts`). Saving the published text again drops the draft.
 */
async function saveImportedFile(
  tx: StoreTx,
  input: { themeId: string; path: string; body: string },
): Promise<{ savedAt: Date; draft: boolean }> {
  const [row] = await tx
    .select()
    .from(themeFile)
    .where(and(eq(themeFile.themeId, input.themeId), eq(themeFile.path, input.path)))
  if (!row) throw new ThemeLibraryError('THEME_NOT_FOUND', `No file ${input.path}`)
  if (row.encoding !== 'utf8' || IMPORT_ONLY.test(input.path)) {
    throw invalid('This file cannot be changed in Edit code')
  }
  const draft = row.body === input.body ? null : input.body
  if (row.draftBody !== draft) {
    await tx.update(themeFile).set({ draftBody: draft }).where(eq(themeFile.id, row.id))
  }
  return { savedAt: new Date(), draft: draft !== null }
}

/**
 * Publishes every unpublished save of an imported theme at once, so files that depend on each
 * other go live together. The original is kept as each file's `import` version the first time;
 * each published file gets a `save` version. Returns how many files went live.
 */
export async function publishCodeDrafts(
  tx: StoreTx,
  storeId: string,
  input: { themeId: string; by?: string | undefined },
): Promise<{ published: number }> {
  if ((await themeKind(tx, input.themeId)) !== 'imported') return { published: 0 }
  const rows = await tx
    .select()
    .from(themeFile)
    .where(and(eq(themeFile.themeId, input.themeId), sql`${themeFile.draftBody} is not null`))
  if (!rows.length) return { published: 0 }
  // Each draft was checked when it was saved; check again, so a broken file never goes live.
  for (const row of rows) {
    const [problem] = codeProblems(row.path, row.draftBody ?? '')
    if (problem) throw invalid(`${row.path}, line ${problem.line}: ${problem.message}`)
  }
  const now = new Date()
  for (const row of rows) {
    const body = row.draftBody ?? row.body
    const [earlier] = await tx
      .select({ id: themeFileVersion.id })
      .from(themeFileVersion)
      .where(and(eq(themeFileVersion.themeId, input.themeId), eq(themeFileVersion.path, row.path)))
      .limit(1)
    if (!earlier) {
      await tx.insert(themeFileVersion).values({
        id: newId(),
        storeId,
        themeId: input.themeId,
        path: row.path,
        body: row.body,
        reason: 'import',
        createdBy: null,
        createdAt: row.createdAt,
      })
    }
    await tx
      .update(themeFile)
      .set({ body, draftBody: null, size: byteLength(body), checksum: checksumOf(body) })
      .where(eq(themeFile.id, row.id))
    await tx.insert(themeFileVersion).values({
      id: newId(),
      storeId,
      themeId: input.themeId,
      path: row.path,
      body,
      reason: 'save',
      createdBy: input.by ?? null,
      createdAt: now,
    })
    await trimVersions(tx, input.themeId, row.path)
  }
  // The renderer caches a theme's files per import record version: move it on.
  await tx.update(themeImport).set({ updatedAt: now }).where(eq(themeImport.themeId, input.themeId))
  await touchTheme(tx, input.themeId, input.by)
  return { published: rows.length }
}

/** Drops an imported theme's unpublished saves: every file, or just `path`. */
export async function discardCodeDrafts(
  tx: StoreTx,
  input: { themeId: string; path?: string | undefined },
): Promise<{ discarded: number }> {
  if ((await themeKind(tx, input.themeId)) !== 'imported') return { discarded: 0 }
  const rows = await tx
    .update(themeFile)
    .set({ draftBody: null })
    .where(
      and(
        eq(themeFile.themeId, input.themeId),
        sql`${themeFile.draftBody} is not null`,
        input.path ? eq(themeFile.path, input.path) : undefined,
      ),
    )
    .returning({ id: themeFile.id })
  return { discarded: rows.length }
}

/** Saves a native template from its JSON: becomes its saved sections, like Save in the editor. */
async function saveNativeTemplate(
  tx: StoreTx,
  storeId: string,
  input: { themeId: string; path: string; body: string; by?: string | undefined },
): Promise<Date> {
  const key = parseNativeTemplatePath(input.path)
  if (!key) throw new ThemeLibraryError('THEME_NOT_FOUND', `No file ${input.path}`)
  const data = parseTemplateData(JSON.parse(input.body))
  if (!data) throw invalid('A template needs "root" and a "content" list of sections')
  if (data.content.length > 60) throw invalid('A template can hold at most 60 sections')
  await saveTemplateDraft(tx, storeId, { themeId: input.themeId, ...key, data })
  await commitTemplateDraft(tx, { themeId: input.themeId, ...key })
  await touchTheme(tx, input.themeId, input.by)
  // Saving the live theme is what shoppers see next: remember it in the history, as Save does.
  if ((await getTheme(tx, input.themeId))?.role === 'main') {
    await snapshotTheme(tx, storeId, { themeId: input.themeId, reason: 'save', by: input.by })
  }
  return new Date()
}

/** Saves one file. Refused with the first problem when it does not read. */
export async function saveCodeFile(
  tx: StoreTx,
  storeId: string,
  input: { themeId: string; path: string; body: string; by?: string | undefined },
): Promise<CodeSaveResult> {
  const kind = await themeKind(tx, input.themeId)
  // Native files are stored as JSON: comments and trailing commas are not allowed there.
  const problems = kind === 'native' ? checkJson(input.body) : codeProblems(input.path, input.body)
  const [problem] = problems
  if (problem) {
    throw invalid(`Line ${problem.line}, column ${problem.column}: ${problem.message}`)
  }
  if (kind === 'imported') {
    return { path: input.path, ...(await saveImportedFile(tx, input)) }
  }
  if (input.path === NATIVE_SETTINGS_PATH) {
    const parsed = ThemeSchema.safeParse(JSON.parse(input.body))
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw invalid(`${issue?.path.join('.') || 'settings'}: ${issue?.message ?? 'not valid'}`)
    }
    await updateThemeSettings(tx, input.themeId, parsed.data, input.by)
    return { path: input.path, savedAt: new Date(), draft: false }
  }
  return { path: input.path, savedAt: await saveNativeTemplate(tx, storeId, input), draft: false }
}

/** Adds a file ("Add a new file"); returns its path. A native theme adds alternate templates. */
export async function createCodeFile(
  tx: StoreTx,
  storeId: string,
  input: { themeId: string; kind: NewFileKind; name: string; by?: string | undefined },
): Promise<{ path: string }> {
  const kind = await themeKind(tx, input.themeId)
  if (!NEW_FILE_KINDS_FOR[kind].includes(input.kind)) {
    throw invalid('This theme cannot have that kind of file')
  }
  if (kind === 'native') {
    const alternate = parseAlternateName(input.name)
    if (!alternate) {
      throw invalid('Name it after the page type, then a dot and a name: product.preorder')
    }
    await createTemplateAlternate(tx, storeId, { themeId: input.themeId, ...alternate })
    return { path: nativeTemplatePath(alternate.template, alternate.suffix) }
  }
  const { folder, ext } = NEW_FILE_KINDS[input.kind]
  const parts = input.name.split('.')
  if (!parts.every((p) => NEW_FILE_NAME.test(p)) || parts.length > 2) {
    throw invalid('Use lowercase letters, numbers and hyphens')
  }
  const path = safeThemePath(`${folder}/${input.name}${ext}`)
  const type = path ? themeContentType(path) : null
  if (!path || !type?.text) throw invalid('Use lowercase letters, numbers and hyphens')
  const [taken] = await tx
    .select({ id: themeFile.id })
    .from(themeFile)
    .where(and(eq(themeFile.themeId, input.themeId), eq(themeFile.path, path)))
  if (taken) throw invalid('A file with that name already exists')
  const body = newFileBody(input.kind, parts[0] ?? input.name)
  const now = new Date()
  await tx.insert(themeFile).values({
    id: newId(),
    storeId,
    themeId: input.themeId,
    path,
    body,
    encoding: 'utf8',
    contentType: type.type,
    size: byteLength(body),
    checksum: checksumOf(body),
    createdAt: now,
  })
  await tx.insert(themeFileVersion).values({
    id: newId(),
    storeId,
    themeId: input.themeId,
    path,
    body,
    reason: 'create',
    createdBy: input.by ?? null,
    createdAt: now,
  })
  await tx.update(themeImport).set({ updatedAt: now }).where(eq(themeImport.themeId, input.themeId))
  await touchTheme(tx, input.themeId, input.by)
  return { path }
}

/**
 * A file's saved versions, newest first. Imported files keep their own history; a native
 * template's history is the theme's version history (each publish, and each save of the live
 * theme). Theme settings have none.
 */
export async function listCodeFileVersions(
  tx: StoreTx,
  themeId: string,
  path: string,
): Promise<CodeFileVersion[]> {
  const kind = await themeKind(tx, themeId)
  if (kind === 'imported') {
    const rows = await tx
      .select({
        id: themeFileVersion.id,
        reason: themeFileVersion.reason,
        createdBy: themeFileVersion.createdBy,
        createdAt: themeFileVersion.createdAt,
      })
      .from(themeFileVersion)
      .where(and(eq(themeFileVersion.themeId, themeId), eq(themeFileVersion.path, path)))
      .orderBy(desc(themeFileVersion.createdAt))
    return rows.map((r) => ({
      ...r,
      batchId: null,
      reason: r.reason as CodeFileVersion['reason'],
    }))
  }
  const key = parseNativeTemplatePath(path)
  if (!key) return []
  const rows = await tx
    .select({
      id: themeVersion.id,
      batchId: themeVersion.batchId,
      reason: themeVersion.reason,
      createdBy: themeVersion.createdBy,
      createdAt: themeVersion.createdAt,
    })
    .from(themeVersion)
    .where(
      and(
        eq(themeVersion.themeId, themeId),
        eq(themeVersion.template, key.template),
        eq(themeVersion.suffix, key.suffix),
      ),
    )
    .orderBy(desc(themeVersion.createdAt))
  return rows.map((r) => ({ ...r, reason: r.reason === 'publish' ? 'publish' : 'save' }))
}

/** One saved version's text, for the diff. */
export async function readCodeFileVersion(
  tx: StoreTx,
  input: { themeId: string; path: string; versionId: string },
): Promise<{ body: string }> {
  const kind = await themeKind(tx, input.themeId)
  if (kind === 'imported') {
    const [row] = await tx
      .select({ body: themeFileVersion.body })
      .from(themeFileVersion)
      .where(
        and(
          eq(themeFileVersion.id, input.versionId),
          eq(themeFileVersion.themeId, input.themeId),
          eq(themeFileVersion.path, input.path),
        ),
      )
    if (!row) throw new ThemeLibraryError('THEME_NOT_FOUND', 'That version no longer exists')
    return row
  }
  const [row] = await tx
    .select({ sections: themeVersion.sections })
    .from(themeVersion)
    .where(and(eq(themeVersion.id, input.versionId), eq(themeVersion.themeId, input.themeId)))
  if (!row) throw new ThemeLibraryError('THEME_NOT_FOUND', 'That version no longer exists')
  return { body: prettyJson(parseTemplateData(row.sections) ?? row.sections) }
}
