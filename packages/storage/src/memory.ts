import type { PresignedUpload, PresignInput, PutInput, StorageProvider } from './types'

export type MemoryStorageOptions = {
  /** Where `publicUrl` points; tests only ever compare the string. */
  publicBaseUrl?: string | undefined
  /** Where presigned uploads point; nothing listens there in tests. */
  uploadBaseUrl?: string | undefined
}

/**
 * In-memory provider for tests and the conformance suite: records what was
 * signed and what was deleted, never touches the network.
 */
export class MemoryStorageProvider implements StorageProvider {
  readonly id = 'memory'
  readonly label = 'In-memory (tests)'
  readonly signed: PresignInput[] = []
  readonly deleted: string[] = []
  readonly objects = new Map<string, { body: Uint8Array; contentType: string }>()
  private readonly publicBase: string
  private readonly uploadBase: string

  constructor(options: MemoryStorageOptions = {}) {
    this.publicBase = (options.publicBaseUrl ?? 'https://media.test').replace(/\/$/, '')
    this.uploadBase = (options.uploadBaseUrl ?? 'https://upload.test').replace(/\/$/, '')
  }

  async presignUpload(input: PresignInput): Promise<PresignedUpload> {
    this.signed.push(input)
    return {
      url: `${this.uploadBase}/${input.key}?sig=test`,
      method: 'PUT',
      headers: { 'content-type': input.contentType },
      expiresIn: 600,
    }
  }

  publicUrl(key: string): string {
    return `${this.publicBase}/${key}`
  }

  async put(input: PutInput): Promise<void> {
    this.objects.set(input.key, { body: input.body, contentType: input.contentType })
  }

  async get(key: string): Promise<Uint8Array | null> {
    return this.objects.get(key)?.body ?? null
  }

  async delete(key: string): Promise<void> {
    this.deleted.push(key)
    this.objects.delete(key)
  }

  async verifyCredentials() {
    return { ok: true, message: 'In-memory storage needs no credentials.' }
  }
}
