/**
 * The storage contract. Object stores (Cloudflare R2, S3, a local folder in
 * development) implement it; the platform asks every provider the same things
 * and never learns how the bucket is addressed.
 *
 * Browser uploads never pass through our servers: the browser asks for a
 * presigned request, PUTs the bytes straight to the store, then confirms.
 * Files the platform generates itself (invoice PDFs) go through `put`, and
 * private ones are read back with `get` behind a signed link.
 */

export type PresignInput = {
  /** Object key the platform chose; see `mediaKey`. Providers store it verbatim. */
  key: string
  contentType: string
  /** Bytes, so the signature can pin the size where the store supports it. */
  size: number
}

export type PresignedUpload = {
  /** Where the browser sends the bytes. */
  url: string
  method: 'PUT' | 'POST'
  /** Headers the browser must send exactly as given (content type, signed headers). */
  headers: Record<string, string>
  /** For POST-policy stores: form fields to send before the file. Empty for PUT. */
  fields?: Record<string, string> | undefined
  /** Seconds until the signature stops working. */
  expiresIn: number
}

export type CredentialCheck = {
  ok: boolean
  /** Shown verbatim in the admin settings page. Must be actionable. */
  message: string
}

/** Bytes the server writes itself, e.g. a rendered invoice PDF. */
export type PutInput = {
  key: string
  body: Uint8Array
  contentType: string
  /**
   * The object's `Cache-Control`, served with it by the bucket and its CDN. Unset: see
   * `cacheControlFor` (`./keys`), which only fills it in where the bytes never change.
   */
  cacheControl?: string | undefined
  /** Gives up on the write (the caller's deadline); providers that cannot cancel may ignore it. */
  signal?: AbortSignal | undefined
}

/**
 * A server-side write straight from a download, never held whole in memory. No size:
 * a download's `content-length` is not the length of the bytes `fetch` hands over
 * (it is the compressed length when the response is gzip/br encoded), so a provider
 * must never declare it up front. Errors and aborts of `body` must reject the write.
 */
export type PutStreamInput = {
  key: string
  body: ReadableStream<Uint8Array>
  contentType: string
  /** As on `PutInput`. */
  cacheControl?: string | undefined
  signal?: AbortSignal | undefined
}

export type StorageProvider = {
  /** Stable id used in store settings and on media rows. Lowercase, no spaces. */
  readonly id: string
  readonly label: string
  presignUpload(input: PresignInput): Promise<PresignedUpload>
  /**
   * Server-side write, for files the platform produces (invoice PDFs, exports)
   * rather than files a browser uploads. Overwrites an existing key.
   */
  put(input: PutInput): Promise<void>
  /**
   * Optional streaming `put` for a body of unknown length (the Shopify importer copies
   * videos download → bucket without holding them whole). Without it callers read the
   * body into memory and use `put`.
   */
  putStream?(input: PutStreamInput): Promise<void>
  /** Server-side read; resolves null for a missing key. Used to stream private files. */
  get(key: string): Promise<Uint8Array | null>
  /**
   * Metadata without the body: the real size on confirm (a browser can lie
   * about `Content-Length` at presign time), and what the worker needs
   * before deciding whether to download the whole object. Resolves null for
   * a missing key.
   */
  head(key: string): Promise<{ size: number; contentType?: string | undefined } | null>
  /** The URL shoppers load. Must be absolute and stable for the life of the object. */
  publicUrl(key: string): string
  /** Idempotent: deleting a missing key resolves. */
  delete(key: string): Promise<void>
  /**
   * Deletes every object whose key starts with `prefix` (always a store folder,
   * `stores/<storeId>/`, when a store is closed) and resolves how many went. Optional:
   * a provider without it gets its files deleted one known key at a time instead.
   */
  deletePrefix?(prefix: string): Promise<number>
  /** Used by the admin settings page to tell the merchant their keys work. */
  verifyCredentials(): Promise<CredentialCheck>
}

/** Same shape as the payments ProviderField; copied so this package stays dependency-free. */
export type ProviderField = {
  key: string
  label: string
  /** Encrypted at rest and masked in the UI. */
  secret?: boolean
  required?: boolean
  multiline?: boolean
  /** `boolean` renders a checkbox and stores 'true' | 'false'. Defaults to text. */
  type?: 'text' | 'boolean'
  help?: string
}

export type StorageProviderFactory<Config> = {
  id: string
  label: string
  /** What the merchant fills in Settings > Files. Drives the form. */
  fields: ProviderField[]
  validateConfig(raw: unknown): { ok: true; config: Config } | { ok: false; errors: string[] }
  create(config: Config): StorageProvider
}
