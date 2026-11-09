import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve, sep } from 'node:path'
import type {
  CredentialCheck,
  PresignedUpload,
  PresignInput,
  PutInput,
  StorageProvider,
  StorageProviderFactory,
} from '@commerce/storage'

export type LocalStorageConfig = {
  /** Origin of the admin app; its `/api/uploads` route receives the bytes and `/uploads/[...key]` serves them. */
  baseUrl: string
  /** Folder the route handlers read and write. Defaults to `LOCAL_STORAGE_DIR` or `./.data/uploads`. */
  dir: string
}

/**
 * Where the admin writes when no folder is configured, relative to the admin
 * app's directory: gitignored, outside `public/` so nothing is served except
 * through the `/uploads/[...key]` route (which sets content type and cache
 * headers itself). Overridden by the `LOCAL_STORAGE_DIR` env var.
 */
export const LOCAL_UPLOAD_DIR = './.data/uploads'

/**
 * Cheap, purely-textual rejects: a NUL byte, a backslash (Windows separator —
 * a key is always `/`-joined, so any `\` is either a Windows traversal
 * attempt or garbage), or an absolute path. Kept as a fast first pass; the
 * real guard is the resolved-path containment check in `localStoragePath`
 * below, which also catches things this can't reliably pattern-match, like
 * `..` split across `/`-segments in unexpected ways or already-decoded
 * percent-escapes.
 */
export function assertSafeKey(key: string): void {
  // Callers (the uploads route, `URLSearchParams.get`) already decode
  // percent-escapes once; this decodes again so a caller that doesn't (or a
  // double-encoded `%252e%252e`) can't hide `..` or `\` from the checks below.
  let decoded = key
  try {
    decoded = decodeURIComponent(key)
  } catch {
    // Malformed escape: fall through and let the raw key fail the checks below.
  }
  for (const candidate of [key, decoded]) {
    if (candidate.includes('\0') || candidate.includes('\\') || isAbsolute(candidate)) {
      throw new Error(`refusing unsafe key ${key}`)
    }
    if (candidate.split('/').includes('..'))
      throw new Error(`refusing path traversal in key ${key}`)
  }
}

/**
 * Absolute path on disk for `key` under `dir` (default: the env/factory
 * default). `LOCAL_UPLOAD_ROOT` lets another process (the worker writing
 * invoice PDFs, the storefront streaming them) agree on the same folder when
 * `dir` is relative.
 *
 * The real traversal guard: resolve `key` against the root, then require the
 * result to still be inside the root. This is what actually stops a
 * traversal — `assertSafeKey`'s textual checks are cheap, early rejects, not
 * the source of truth, because `path.resolve` collapses `..` regardless of
 * how it was spelled (`..`, `.` `.` joined oddly, a decoded `%2e%2e`, ...).
 */
export function localStoragePath(key: string, dir = localStorageDir()): string {
  assertSafeKey(key)
  const root = process.env.LOCAL_UPLOAD_ROOT
  // turbopackIgnore: a runtime data folder, not a build input (else the build traces the whole app).
  const base = isAbsolute(dir) || !root ? dir : join(/* turbopackIgnore: true */ root, dir)
  const resolvedRoot = resolve(base)
  const resolvedPath = resolve(resolvedRoot, key)
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(resolvedRoot + sep)) {
    throw new Error(`refusing path traversal in key ${key}`)
  }
  return resolvedPath
}

/** The folder local storage writes into, honouring `LOCAL_STORAGE_DIR`. */
export function localStorageDir(): string {
  return process.env.LOCAL_STORAGE_DIR?.trim() || LOCAL_UPLOAD_DIR
}

/**
 * Built-in storage: files are saved on disk under `LOCAL_STORAGE_DIR`
 * (default `./.data/uploads`, gitignored) and served through the admin's
 * `/uploads/[...key]` route. No account, no CORS, works offline. It is the
 * default when a store has no storage Connection installed; installing one
 * (Cloudflare R2, later S3) and moving files over with "Move existing files
 * to <connection>" switches new uploads to it.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly id = 'local'
  readonly label = 'Local disk'
  private readonly base: string

  constructor(private readonly config: LocalStorageConfig) {
    this.base = config.baseUrl.replace(/\/$/, '')
  }

  async presignUpload(input: PresignInput): Promise<PresignedUpload> {
    // The route handler checks the session and that the key belongs to the store; nothing to sign.
    return {
      url: `${this.base}/api/uploads?key=${encodeURIComponent(input.key)}`,
      method: 'PUT',
      headers: { 'content-type': input.contentType },
      expiresIn: 24 * 60 * 60,
    }
  }

  publicUrl(key: string): string {
    return `${this.base}/uploads/${key}`
  }

  async put(input: PutInput): Promise<void> {
    const path = this.pathOf(input.key)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, input.body)
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await readFile(this.pathOf(key)))
    } catch (err) {
      if ((err as { code?: string }).code === 'ENOENT') return null
      throw err
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true })
  }

  /** Removes the folder `prefix` names (a store's `stores/<id>/`) and everything in it. */
  async deletePrefix(prefix: string): Promise<number> {
    if (!prefix.endsWith('/') || prefix === '/') throw new Error(`refusing prefix ${prefix}`)
    const folder = this.pathOf(prefix.slice(0, -1))
    let files: string[] = []
    try {
      files = (await readdir(folder, { recursive: true, withFileTypes: true }))
        .filter((e) => e.isFile())
        .map((e) => e.name)
    } catch (err) {
      if ((err as { code?: string }).code === 'ENOENT') return 0
      throw err
    }
    await rm(folder, { recursive: true, force: true })
    return files.length
  }

  async head(key: string): Promise<{ size: number } | null> {
    try {
      const s = await stat(this.pathOf(key))
      return { size: s.size }
    } catch (err) {
      if ((err as { code?: string }).code === 'ENOENT') return null
      throw err
    }
  }

  private pathOf(key: string): string {
    return localStoragePath(key, this.config.dir)
  }

  async verifyCredentials(): Promise<CredentialCheck> {
    return { ok: true, message: `Files are written to ${this.config.dir} on this machine.` }
  }
}

export const localStorageFactory: StorageProviderFactory<LocalStorageConfig> = {
  id: 'local',
  label: 'Local disk',
  fields: [],
  validateConfig(raw) {
    const r = (raw ?? {}) as Partial<LocalStorageConfig>
    return {
      ok: true,
      config: {
        baseUrl: r.baseUrl?.trim() || process.env.ADMIN_URL || 'http://localhost:3200',
        dir: r.dir?.trim() || localStorageDir(),
      },
    }
  },
  create: (config) => new LocalStorageProvider(config),
}
