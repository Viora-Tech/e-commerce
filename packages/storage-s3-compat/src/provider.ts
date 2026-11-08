import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import type {
  PresignedUpload,
  PresignInput,
  PutInput,
  PutStreamInput,
  StorageProvider,
} from '@commerce/storage'
import { cacheControlFor } from '@commerce/storage/keys'
import { defaultSign, S3_COMPAT_PRESIGN_SECONDS, type S3CompatDeps, type SignFn } from './client'

/**
 * Hard deadline for one bucket call, body included. The SDK's `requestTimeout` is a socket
 * idle timer that Bun's HTTP layer does not always honour, and a response body that stalls
 * part way never trips it: a stuck GET held a media job (and its database transaction) for
 * 23 minutes in production on 2026-10-11. Aborting rejects the call so the job retries.
 */
const S3_COMPAT_OP_TIMEOUT_MS = 2 * 60_000

const opSignal = (caller?: AbortSignal): AbortSignal => {
  const deadline = AbortSignal.timeout(S3_COMPAT_OP_TIMEOUT_MS)
  return caller ? AbortSignal.any([caller, deadline]) : deadline
}

/**
 * `putStream` sends the body in parts of this size, at most `STREAM_PARTS_IN_FLIGHT`
 * at a time, so one streamed copy holds about 16 MB. A body that fits in one part goes
 * as a single PUT with its exact length.
 */
const STREAM_PART_BYTES = 8 * 1024 * 1024
const STREAM_PARTS_IN_FLIGHT = 2

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
        CacheControl: cacheControlFor(input),
      }),
      { abortSignal: opSignal(input.signal) },
    )
  }

  /**
   * A web stream of unknown length into the bucket, through the SDK's multipart
   * `Upload`: every request carries a buffer of known size, so no length is ever
   * declared up front. (A single PUT piping the stream with the download's
   * `content-length` hangs for good when the two disagree, as they do for a gzip
   * response, or when the download breaks part way: the SDK never ends the request.)
   * A broken or aborted body rejects, and a multipart upload already begun is aborted.
   */
  async putStream(input: PutStreamInput): Promise<void> {
    input.signal?.throwIfAborted()
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: this.fullKey(input.key),
        Body: input.body,
        ContentType: input.contentType,
        CacheControl: cacheControlFor(input),
      },
      partSize: STREAM_PART_BYTES,
      queueSize: STREAM_PARTS_IN_FLIGHT,
      leavePartsOnError: false,
    })
    // `done()` rejects at once; the caller's signal should also end the download feeding `body`.
    const stop = () => void upload.abort()
    input.signal?.addEventListener('abort', stop, { once: true })
    try {
      await upload.done()
    } finally {
      input.signal?.removeEventListener('abort', stop)
    }
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      const abortSignal = opSignal()
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: this.fullKey(key) }),
        { abortSignal },
      )
      if (!res.Body) return null
      // The body read is covered too: a stream that stops mid-way rejects at the deadline.
      return await Promise.race([
        res.Body.transformToByteArray(),
        new Promise<never>((_, reject) => {
          abortSignal.addEventListener('abort', () => reject(abortSignal.reason), { once: true })
        }),
      ])
    } catch (err) {
      const name = err instanceof Error ? err.name : ''
      if (name === 'NoSuchKey' || name === 'NotFound') return null
      throw err
    }
  }

  async delete(key: string): Promise<void> {
    // S3 semantics: deleting a missing key is a 204, so this is idempotent for free.
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: this.fullKey(key) }),
      { abortSignal: opSignal() },
    )
  }

  /**
   * Lists the prefix a page at a time (1,000 keys, S3's ceiling for both calls) and
   * deletes each page in one `DeleteObjects` request. A refused prefix that does not end
   * in `/` would also match a sibling folder (`stores/ab` and `stores/abc`), so it is not
   * allowed.
   */
  async deletePrefix(prefix: string): Promise<number> {
    if (!prefix.endsWith('/') || prefix === '/') throw new Error(`refusing prefix ${prefix}`)
    let deleted = 0
    let token: string | undefined
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: this.fullKey(prefix),
          ContinuationToken: token,
          MaxKeys: 1000,
        }),
        { abortSignal: opSignal() },
      )
      const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []))
      if (keys.length > 0) {
        await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: keys, Quiet: true },
          }),
          { abortSignal: opSignal() },
        )
        deleted += keys.length
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined
    } while (token)
    return deleted
  }

  async head(key: string): Promise<{ size: number; contentType?: string } | null> {
    try {
      const res = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.fullKey(key) }),
        { abortSignal: opSignal() },
      )
      return {
        size: res.ContentLength ?? 0,
        ...(res.ContentType ? { contentType: res.ContentType } : {}),
      }
    } catch (err) {
      const name = err instanceof Error ? err.name : ''
      if (name === 'NotFound' || name === 'NoSuchKey') return null
      throw err
    }
  }

  abstract verifyCredentials(): ReturnType<StorageProvider['verifyCredentials']>
}
