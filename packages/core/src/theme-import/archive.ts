/** SOURCE OF TRUTH: Shopify theme zip reading — WHAT: unpack the zip Shopify emails ("Download theme file") into a checked map of theme files: size caps, file-count cap, zip-slip safe paths, only the folders and file types a theme has / WHY: the upload is untrusted bytes, and nothing in it is ever executed on our servers; every later step reads only what this returns */
import { unzipSync } from 'fflate'
import { CommerceError } from '../errors'

/** Upload and unpack limits. A large real theme (Zero Drift) is ~5 MB unpacked. */
const THEME_ARCHIVE_LIMITS = {
  /** The zip itself. */
  zipBytes: 50 * 1024 * 1024,
  /** Everything unpacked together. */
  totalBytes: 120 * 1024 * 1024,
  /** One unpacked file. */
  fileBytes: 15 * 1024 * 1024,
  files: 4000,
} as const

/** Folders a Shopify theme has. Anything else in the zip is skipped and listed. */
const THEME_FOLDERS = [
  'assets',
  'blocks',
  'config',
  'layout',
  'locales',
  'sections',
  'snippets',
  'templates',
] as const
export type ThemeFolder = (typeof THEME_FOLDERS)[number]

const TEXT_TYPES: Record<string, string> = {
  liquid: 'text/x-liquid',
  json: 'application/json',
  css: 'text/css',
  scss: 'text/x-scss',
  js: 'text/javascript',
  mjs: 'text/javascript',
  map: 'application/json',
  svg: 'image/svg+xml',
  txt: 'text/plain',
  md: 'text/markdown',
}

const BINARY_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  glb: 'model/gltf-binary',
}

export type ThemeFileEntry = {
  path: string
  bytes: Uint8Array
  contentType: string
  /** Text files are decoded as UTF-8; binary ones stay bytes. */
  text: boolean
}

export type ThemeArchive = {
  files: Map<string, ThemeFileEntry>
  /** Entries left out (wrong folder or type), for the import report. */
  skipped: string[]
}

export class ThemeArchiveProblem extends CommerceError {
  constructor(message: string) {
    super('THEME_ARCHIVE_INVALID', message)
  }
}

/** `a.css.liquid` → `liquid`; `a.min.js` → `js`. */
const extensionOf = (path: string): string => path.split('.').pop()?.toLowerCase() ?? ''

/** The content type for a theme file, or null for a type a theme never has. */
function themeContentType(path: string): { type: string; text: boolean } | null {
  const ext = extensionOf(path)
  if (TEXT_TYPES[ext]) return { type: TEXT_TYPES[ext], text: true }
  if (BINARY_TYPES[ext]) return { type: BINARY_TYPES[ext], text: false }
  return null
}

/**
 * A safe, normalised path inside the theme, or null. Rejects anything that could
 * climb out of the theme (`..`, absolute paths, drive letters, NUL) rather than
 * trying to clean it: a theme zip has no business containing such names.
 */
export function safeThemePath(raw: string): string | null {
  if (raw.includes('\0')) return null
  const path = raw.replace(/\\/g, '/')
  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) return null
  const parts = path.split('/').filter((p) => p !== '' && p !== '.')
  if (parts.some((p) => p === '..')) return null
  if (parts.length === 0) return null
  return parts.join('/')
}

/** Shopify zips put the folders at the root; some tools wrap them in one folder. */
function commonRoot(paths: string[]): string {
  const firsts = new Set(paths.map((p) => p.split('/')[0]))
  if (firsts.size !== 1) return ''
  const [only] = [...firsts]
  if (!only || (THEME_FOLDERS as readonly string[]).includes(only)) return ''
  return `${only}/`
}

/** Allowed depth: `templates/customers/x.json` is the one nested folder Shopify uses. */
function inThemeFolder(path: string): boolean {
  const parts = path.split('/')
  const folder = parts[0] as ThemeFolder
  if (!(THEME_FOLDERS as readonly string[]).includes(folder)) return false
  if (parts.length === 2) return true
  return parts.length === 3 && folder === 'templates' && parts[1] === 'customers'
}

/**
 * Reads the uploaded zip. Throws `ThemeArchiveProblem` with a message the merchant
 * can act on when it is too large, not a zip, or not a Shopify theme.
 */
export function readThemeArchive(zip: Uint8Array): ThemeArchive {
  if (zip.byteLength > THEME_ARCHIVE_LIMITS.zipBytes) {
    throw new ThemeArchiveProblem('This file is larger than 50 MB. Upload the theme zip only.')
  }
  let declared = 0
  let count = 0
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(zip, {
      // Checked from the zip's own directory before anything is inflated.
      filter: (file) => {
        if (file.name.endsWith('/')) return false
        count += 1
        declared += file.originalSize
        if (count > THEME_ARCHIVE_LIMITS.files) {
          throw new ThemeArchiveProblem('This zip has too many files to be a theme.')
        }
        if (file.originalSize > THEME_ARCHIVE_LIMITS.fileBytes) return false
        if (declared > THEME_ARCHIVE_LIMITS.totalBytes) {
          throw new ThemeArchiveProblem('This zip unpacks to more than 120 MB.')
        }
        return true
      },
    })
  } catch (err) {
    if (err instanceof ThemeArchiveProblem) throw err
    throw new ThemeArchiveProblem('This file is not a zip. Upload the .zip Shopify emailed you.')
  }

  const names = Object.keys(entries)
  const root = commonRoot(names.map((n) => safeThemePath(n) ?? '').filter(Boolean))
  const files = new Map<string, ThemeFileEntry>()
  const skipped: string[] = []
  let total = 0
  for (const name of names) {
    const bytes = entries[name]
    const safe = safeThemePath(name)
    if (!bytes || !safe) {
      skipped.push(name)
      continue
    }
    const path = root && safe.startsWith(root) ? safe.slice(root.length) : safe
    const type = themeContentType(path)
    if (!inThemeFolder(path) || !type || bytes.byteLength > THEME_ARCHIVE_LIMITS.fileBytes) {
      skipped.push(path)
      continue
    }
    total += bytes.byteLength
    if (total > THEME_ARCHIVE_LIMITS.totalBytes) {
      throw new ThemeArchiveProblem('This zip unpacks to more than 120 MB.')
    }
    files.set(path, { path, bytes, contentType: type.type, text: type.text })
  }
  if (!files.has('layout/theme.liquid')) {
    throw new ThemeArchiveProblem(
      'This zip is not a Shopify theme: layout/theme.liquid is missing. In Shopify, open Online Store › Themes › ⋯ › Download theme file, then upload the zip from the email.',
    )
  }
  if (![...files.keys()].some((p) => p.startsWith('templates/'))) {
    throw new ThemeArchiveProblem('This zip has no templates folder, so it is not a full theme.')
  }
  return { files, skipped }
}

const decoder = new TextDecoder('utf-8')

/** A text file's contents, or null when absent or binary. */
export function archiveText(archive: ThemeArchive, path: string): string | null {
  const entry = archive.files.get(path)
  if (!entry?.text) return null
  return decoder.decode(entry.bytes)
}
