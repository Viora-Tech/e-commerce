import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3'
import type { PresignedUpload, PresignInput, PutInput, StorageProvider } from '@commerce/storage'
import { defaultSign, S3_COMPAT_PRESIGN_SECONDS, type S3CompatDeps, type SignFn } from './client'

export type S3CompatProviderOptions = {
  bucket: string
  /** Base URL objects are readable from (own domain, r2.dev subdomain, CloudFront, bucket website endpoint, ...). */
  publicBaseUrl: string
  /** Prepended to every key this provider is asked to touch (e.g. a per-deployment folder). */
  keyPrefix?: string | undefined
}

/**
 * The behaviour every S3-compatible object store (Cloudflare R2, Amazon S3, ...) shares:
 * presigned PUT for browser uploads, server-side put/get/delete, and a public URL built from
 * a base the merchant supplies rather than the S3 endpoint. Adapters (`R2StorageProvider`,
 * `S3StorageProvider`) only add their own `id`, `label`, endpoint construction and
 * `verifyCredentials` message. Kept here so a CORS/presigning bug is fixed once, not twice.
 */
export abstract class S3CompatProvider implements StorageProvider {
  abstract readonly id: string
  abstract readonly label: string
  protected readonly client: S3Client
  protected readonly sign: SignFn
  protected readonly bucket: string
  protected readonly publicBase: string
  protected readonly keyPrefix: string

  constructor(client: S3Client, opts: S3CompatProviderOptions, deps: S3CompatDeps = {}) {
    this.client = client
    this.sign = deps.sign ?? defaultSign
    this.bucket = opts.bucket
    this.publicBase = opts.publicBaseUrl.replace(/\/$/, '')
    this.keyPrefix = opts.keyPrefix ? `${opts.keyPrefix.replace(/^\/|\/$/g, '')}/` : ''
  }

  private fullKey(key: string): string {
    return `${this.keyPrefix}${key}`
  }

  async presignUpload(input: PresignInput): Promise<PresignedUpload> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: this.fullKey(input.key),
      ContentType: input.contentType,
      ContentLength: input.size,
    })
    const url = await this.sign(this.client, command, S3_COMPAT_PRESIGN_SECONDS)
    return {
      url,
      method: 'PUT',
      headers: { 'content-type': input.contentType },
      expiresIn: S3_COMPAT_PRESIGN_SECONDS,
    }
  }

  publicUrl(key: string): string {
    return `${this.publicBase}/${this.fullKey(key)}`
  }

  async put(input: PutInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.fullKey(input.key),
        Body: input.body,
        ContentType: input.contentType,
        ContentLength: input.body.byteLength,
      }),
    )
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: this.fullKey(key) }),
      )
      return res.Body ? await res.Body.transformToByteArray() : null
    } catch (err) {
      const name = err instanceof Error ? err.name : ''
      if (name === 'NoSuchKey' || name === 'NotFound') return null
      throw err
    }
  }

  async delete(key: string): Promise<void> {
    // S3 semantics: deleting a missing key is a 204, so this is idempotent for free.
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.fullKey(key) }))
  }

  async head(key: string): Promise<{ size: number; contentType?: string } | null> {
    try {
      const res = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.fullKey(key) }),
      )
      return { size: res.ContentLength ?? 0, contentType: res.ContentType }
    } catch (err) {
      const name = err instanceof Error ? err.name : ''
      if (name === 'NotFound' || name === 'NoSuchKey') return null
      throw err
    }
  }

  abstract verifyCredentials(): ReturnType<StorageProvider['verifyCredentials']>
}
