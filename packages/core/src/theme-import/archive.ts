/** SOURCE OF TRUTH: Shopify theme zip reading — WHAT: unpack the zip Shopify emails ("Download theme file") into a checked map of theme files: size caps counted on the bytes actually inflated (never on what the zip claims), file-count cap, zip-slip safe paths, only the folders and file types a theme has / WHY: the upload is untrusted bytes, and nothing in it is ever executed on our servers; every later step reads only what this returns */
import { Inflate } from 'fflate'
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
export function themeContentType(path: string): { type: string; text: boolean } | null {
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

const NOT_A_ZIP = 'This file is not a zip. Upload the .zip Shopify emailed you.'
const TOO_BIG = 'This zip unpacks to more than 120 MB.'

/** One entry of the zip's central directory: where its bytes are and what it claims. */
type ZipEntry = {
  name: string
  method: number
  flags: number
  compressedSize: number
  declaredSize: number
  localOffset: number
}

const u16 = (b: Uint8Array, at: number) => (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8)
const u32 = (b: Uint8Array, at: number) => (u16(b, at) | (u16(b, at + 2) << 16)) >>> 0

/** The central directory (the zip's own table of contents), bounds-checked. */
function zipEntries(zip: Uint8Array): ZipEntry[] {
  // End of central directory: 22 bytes plus an optional comment of up to 64 KB.
  let end = -1
  for (let i = zip.length - 22; i >= 0 && i >= zip.length - 22 - 0xffff; i--) {
    if (u32(zip, i) === 0x06054b50) {
      end = i
      break
    }
  }
  if (end < 0) throw new ThemeArchiveProblem(NOT_A_ZIP)
  const count = u16(zip, end + 10)
  let at = u32(zip, end + 16)
  // ZIP64 (over 65,535 files or 4 GB) is never a theme.
  if (count === 0xffff || at === 0xffffffff) throw new ThemeArchiveProblem(NOT_A_ZIP)
  const names = new TextDecoder('utf-8')
  const entries: ZipEntry[] = []
  for (let n = 0; n < count; n++) {
    if (at + 46 > zip.length || u32(zip, at) !== 0x02014b50) {
      throw new ThemeArchiveProblem(NOT_A_ZIP)
    }
    const nameLength = u16(zip, at + 28)
    const next = at + 46 + nameLength + u16(zip, at + 30) + u16(zip, at + 32)
    if (next > zip.length) throw new ThemeArchiveProblem(NOT_A_ZIP)
    entries.push({
      flags: u16(zip, at + 8),
      method: u16(zip, at + 10),
      compressedSize: u32(zip, at + 20),
      declaredSize: u32(zip, at + 24),
      localOffset: u32(zip, at + 42),
      name: names.decode(zip.subarray(at + 46, at + 46 + nameLength)),
    })
    at = next
  }
  return entries
}

/** Compressed bytes are fed to the inflater this many at a time, so one step stays small. */
const INFLATE_STEP = 16 * 1024

/** Thrown from inside the inflater to stop it the moment it passes its budget. */
class OverBudget extends CommerceError {
  constructor() {
    super('THEME_ARCHIVE_OVER_BUDGET', 'a zip entry inflated past its declared size')
  }
}

/**
 * One entry's bytes, inflated against what it declared: the count is of bytes actually
 * produced, and inflation stops as soon as it passes the declared size. A zip whose
 * directory understates a file (a "zip bomb" that says 1 KB and inflates to gigabytes)
 * costs one small step of work, never the whole expansion. Null for an entry we do not
 * read (encrypted, an unknown compression, a stored size that does not add up).
 */
function entryBytes(zip: Uint8Array, entry: ZipEntry): Uint8Array | null {
  const local = entry.localOffset
  if (local + 30 > zip.length || u32(zip, local) !== 0x04034b50) {
    throw new ThemeArchiveProblem(NOT_A_ZIP)
  }
  const start = local + 30 + u16(zip, local + 26) + u16(zip, local + 28)
  const end = start + entry.compressedSize
  if (end > zip.length) throw new ThemeArchiveProblem(NOT_A_ZIP)
  if (entry.flags & 1) return null
  const data = zip.subarray(start, end)
  if (entry.method === 0) return data.byteLength === entry.declaredSize ? data.slice() : null
  if (entry.method !== 8) return null
  const out = new Uint8Array(entry.declaredSize)
  let size = 0
  const inflater = new Inflate((chunk) => {
    if (size + chunk.byteLength > out.byteLength) throw new OverBudget()
    out.set(chunk, size)
    size += chunk.byteLength
  })
  try {
    for (let i = 0; i < data.byteLength; i += INFLATE_STEP) {
      inflater.push(data.subarray(i, i + INFLATE_STEP), i + INFLATE_STEP >= data.byteLength)
    }
    if (data.byteLength === 0) inflater.push(new Uint8Array(0), true)
  } catch (err) {
    if (err instanceof OverBudget) throw new ThemeArchiveProblem(TOO_BIG)
    throw new ThemeArchiveProblem(NOT_A_ZIP)
  }
  return size === out.byteLength ? out : null
}

/**
 * Reads the uploaded zip. Throws `ThemeArchiveProblem` with a message the merchant
 * can act on when it is too large, not a zip, or not a Shopify theme.
 */
export function readThemeArchive(zip: Uint8Array): ThemeArchive {
  if (zip.byteLength > THEME_ARCHIVE_LIMITS.zipBytes) {
    throw new ThemeArchiveProblem('This file is larger than 50 MB. Upload the theme zip only.')
  }
  const listed = zipEntries(zip).filter((e) => !e.name.endsWith('/'))
  if (listed.length > THEME_ARCHIVE_LIMITS.files) {
    throw new ThemeArchiveProblem('This zip has too many files to be a theme.')
  }
  const entries: Record<string, Uint8Array | null> = {}
  let declared = 0
  for (const entry of listed) {
    // Checked from the zip's own directory before anything is inflated; `entryBytes`
    // then holds every file to what it declared, so these sums bound the real work.
    if (entry.declaredSize > THEME_ARCHIVE_LIMITS.fileBytes) continue
    declared += entry.declaredSize
    if (declared > THEME_ARCHIVE_LIMITS.totalBytes) throw new ThemeArchiveProblem(TOO_BIG)
    entries[entry.name] = entryBytes(zip, entry)
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
