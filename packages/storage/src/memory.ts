import type { PresignedUpload, PresignInput, StorageProvider } from './types'

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

  async delete(key: string): Promise<void> {
    this.deleted.push(key)
  }

  async verifyCredentials() {
    return { ok: true, message: 'In-memory storage needs no credentials.' }
  }
}
