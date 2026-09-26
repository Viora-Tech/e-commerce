import { HeadBucketCommand } from '@aws-sdk/client-s3'
import type { CredentialCheck, StorageProviderFactory } from '@commerce/storage'
import {
  makeS3CompatClient,
  type S3CompatDeps,
  S3CompatProvider,
} from '@commerce/storage-s3-compat'

export type R2Config = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  /**
   * Where objects are readable: the bucket's r2.dev subdomain or a custom
   * domain connected in the Cloudflare dashboard. Uploads are presigned
   * against the S3 endpoint; reads never touch it.
   */
  publicBaseUrl: string
  /** Override the S3 endpoint (tests, or an enterprise jurisdiction endpoint). */
  endpoint?: string | undefined
}

/** How long a presigned PUT stays valid. Long enough for a slow mobile upload, short enough to be useless later. */
export const R2_PRESIGN_SECONDS = 15 * 60

export const r2Endpoint = (accountId: string) => `https://${accountId}.r2.cloudflarestorage.com`

/**
 * Cloudflare R2 through its S3-compatible API. The browser PUTs straight to
 * the bucket with a presigned URL; the platform never proxies bytes.
 * Requires a CORS rule on the bucket allowing PUT from the admin origin.
 */
export class R2StorageProvider extends S3CompatProvider {
  readonly id = 'r2'
  readonly label = 'Cloudflare R2'

  constructor(config: R2Config, deps: S3CompatDeps = {}) {
    const client =
      deps.client ??
      makeS3CompatClient({
        region: 'auto',
        endpoint: config.endpoint ?? r2Endpoint(config.accountId),
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      })
    super(client, { bucket: config.bucket, publicBaseUrl: config.publicBaseUrl }, deps)
  }

  async verifyCredentials(): Promise<CredentialCheck> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }))
      return { ok: true, message: `Connected to bucket "${this.bucket}".` }
    } catch (err) {
      const name = err instanceof Error ? err.name : 'Error'
      if (name === 'NotFound' || name === 'NoSuchBucket') {
        return {
          ok: false,
          message: `Bucket "${this.bucket}" does not exist on this account.`,
        }
      }
      if (name === 'InvalidAccessKeyId' || name === 'SignatureDoesNotMatch' || name === '403') {
        return {
          ok: false,
          message:
            'R2 rejected the access key or secret. Create an R2 API token with Object Read & Write.',
        }
      }
      return {
        ok: false,
        message: `Could not reach R2: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }
}

function stringField(raw: Record<string, unknown>, key: string): string {
  const v = raw[key]
  return typeof v === 'string' ? v.trim() : ''
}

export const r2Factory: StorageProviderFactory<R2Config> = {
  id: 'r2',
  label: 'Cloudflare R2',
  fields: [
    {
      key: 'accountId',
      label: 'Account ID',
      required: true,
      help: 'Cloudflare dashboard, R2 overview, right-hand column.',
    },
    { key: 'accessKeyId', label: 'Access key ID', required: true },
    {
      key: 'secretAccessKey',
      label: 'Secret access key',
      secret: true,
      required: true,
      help: 'From an R2 API token with Object Read & Write on this bucket.',
    },
    { key: 'bucket', label: 'Bucket', required: true },
    {
      key: 'publicBaseUrl',
      label: 'Public URL',
      required: true,
      help: 'The bucket public URL (pub-xxxx.r2.dev) or a custom domain connected to the bucket. Add a CORS rule allowing PUT from your admin origin.',
    },
  ],
  validateConfig(raw) {
    const r = (raw ?? {}) as Record<string, unknown>
    const config: R2Config = {
      accountId: stringField(r, 'accountId'),
      accessKeyId: stringField(r, 'accessKeyId'),
      secretAccessKey: stringField(r, 'secretAccessKey'),
      bucket: stringField(r, 'bucket'),
      publicBaseUrl: stringField(r, 'publicBaseUrl'),
    }
    const errors: string[] = []
    for (const k of ['accountId', 'accessKeyId', 'secretAccessKey', 'bucket'] as const) {
      if (!config[k]) errors.push(`${k} is required`)
    }
    if (!/^https?:\/\//.test(config.publicBaseUrl))
      errors.push('publicBaseUrl must start with https://')
    return errors.length ? { ok: false, errors } : { ok: true, config }
  },
  create: (config) => new R2StorageProvider(config),
}
