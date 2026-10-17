import { type CodeProblem, checkCode, checkJson } from '@commerce/core/theme-code'
import type { api } from '@/lib/api-client'

/** Edit code's API shapes, as the browser receives them. */
export type CodeFileList = Awaited<ReturnType<typeof api.themes.code.files>>
export type CodeFile = Awaited<ReturnType<typeof api.themes.code.read>>
export type CodeFileEntry = CodeFileList['files'][number]
export type CodeFileVersion = Awaited<ReturnType<typeof api.themes.code.versions>>[number]

/** Edit code's folders in Shopify's order; anything else follows, alphabetically. */
const FOLDER_ORDER = [
  'layout',
  'templates',
  'sections',
  'blocks',
  'snippets',
  'assets',
  'config',
  'locales',
]

export type CodeFolder<T extends { path: string }> = { name: string; files: T[] }

/** `sections/hero.liquid` → `hero.liquid`. */
export const codeFileName = (path: string) => path.slice(path.lastIndexOf('/') + 1)

/** `sections/hero.liquid` → `sections`. */
export const codeFolderOf = (path: string) =>
  path.includes('/') ? path.slice(0, path.indexOf('/')) : ''

/** Files grouped by their top folder, folders in Shopify's order. */
export function codeFolders<T extends { path: string }>(files: readonly T[]): CodeFolder<T>[] {
  const byFolder = new Map<string, T[]>()
  for (const f of files) {
    const folder = codeFolderOf(f.path)
    byFolder.set(folder, [...(byFolder.get(folder) ?? []), f])
  }
  const rank = (name: string) => {
    const i = FOLDER_ORDER.indexOf(name)
    return i === -1 ? FOLDER_ORDER.length : i
  }
  return [...byFolder.entries()]
    .map(([name, list]) => ({ name, files: list.sort((a, b) => a.path.localeCompare(b.path)) }))
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
}

/** A library section's type as a name: `SplitHero` → `Split hero`. */
export function sectionTypeName(type: string): string {
  const words = type.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(' ')
  return words.map((w, i) => (i === 0 ? w : w.toLowerCase())).join(' ')
}

/** `SplitHero` → `split-hero`, as the file tree shows library sections. */
export function sectionTypeSlug(type: string): string {
  return type.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

/** Files whose name or path holds every word typed, best (name starts with it) first. */
export function searchCodeFiles<T extends { path: string }>(files: readonly T[], query: string) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  return files
    .filter((f) => words.every((w) => f.path.toLowerCase().includes(w)))
    .sort((a, b) => {
      const first = words[0] ?? ''
      const aStarts = codeFileName(a.path).toLowerCase().startsWith(first) ? 0 : 1
      const bStarts = codeFileName(b.path).toLowerCase().startsWith(first) ? 0 : 1
      return aStarts - bStarts || a.path.localeCompare(b.path)
    })
    .slice(0, 12)
}

/** Line and column of the caret in a textarea's text. */
export function caretPosition(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, offset)
  const line = before.split('\n').length
  return { line, column: offset - before.lastIndexOf('\n') }
}

/** The character offset where a line starts, for jumping to a problem. */
export function lineOffset(text: string, line: number): number {
  let at = 0
  for (let i = 1; i < line; i++) {
    const next = text.indexOf('\n', at)
    if (next === -1) return text.length
    at = next + 1
  }
  return at
}

/** A locked library section's place among the open tabs: `library/SplitHero`. */
export const LIBRARY_PREFIX = 'library/'

export const libraryPath = (type: string) => `${LIBRARY_PREFIX}${type}`

/** The section type of a library tab, or null for a real file. */
export const libraryTypeOf = (path: string) =>
  path.startsWith(LIBRARY_PREFIX) ? path.slice(LIBRARY_PREFIX.length) : null

/**
 * Problems of every open, editable file, by path. Native theme files are stored as JSON, so
 * they get the strict check (no comments, no trailing commas); imported files the theme's own.
 */
export function openFileProblems(
  kind: 'imported' | 'native',
  buffers: Record<string, { text: string; file: { editable: boolean } }>,
): Map<string, CodeProblem[]> {
  const out = new Map<string, CodeProblem[]>()
  for (const [path, b] of Object.entries(buffers)) {
    if (!b.file.editable) continue
    out.set(path, kind === 'native' ? checkJson(b.text) : checkCode(path, b.text))
  }
  return out
}
