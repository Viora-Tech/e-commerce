import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join } from 'node:path'
import type {
  CredentialCheck,
  PresignedUpload,
  PresignInput,
  PutInput,
  StorageProvider,
  StorageProviderFactory,
} from '@commerce/storage'

export type LocalStorageConfig = {
  /** Origin of the admin app; its `/api/uploads` route receives the bytes and serves `/uploads/...`. */
  baseUrl: string
  /** Folder the route handler writes into. Defaults to the admin app's `public/uploads`. */
  dir: string
}

/** Where the admin writes when no folder is configured; served by Next from `public/`. */
export const LOCAL_UPLOAD_DIR = 'public/uploads'

/**
 * Development storage: the browser "uploads" to a route handler in the admin
 * app, which writes the file under `public/uploads` so Next serves it. No
 * account, no CORS, works offline. Files added after a production build are
 * not served, so it is the built-in fallback, never a deployment choice.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly id = 'local'
  readonly label = 'Local folder (development only)'
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

  /**
   * The folder is relative to the admin app. Other processes (the worker writing
   * invoice PDFs, the storefront streaming them) set `LOCAL_UPLOAD_ROOT` to the
   * admin app directory so every process agrees on one folder.
   */
  private pathOf(key: string): string {
    if (key.split('/').includes('..')) throw new Error(`refusing path traversal in key ${key}`)
    const dir = this.config.dir
    const root = process.env.LOCAL_UPLOAD_ROOT
    return join(isAbsolute(dir) || !root ? dir : join(root, dir), key)
  }

  async verifyCredentials(): Promise<CredentialCheck> {
    return { ok: true, message: `Files are written to ${this.config.dir} on this machine.` }
  }
}

export const localStorageFactory: StorageProviderFactory<LocalStorageConfig> = {
  id: 'local',
  label: 'Local folder (development only)',
  fields: [],
  validateConfig(raw) {
    const r = (raw ?? {}) as Partial<LocalStorageConfig>
    return {
      ok: true,
      config: {
        baseUrl: r.baseUrl?.trim() || process.env.ADMIN_URL || 'http://localhost:3200',
        dir: r.dir?.trim() || LOCAL_UPLOAD_DIR,
      },
    }
  },
  create: (config) => new LocalStorageProvider(config),
}
