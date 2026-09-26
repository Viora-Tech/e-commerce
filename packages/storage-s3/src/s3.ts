import { HeadObjectCommand } from '@aws-sdk/client-s3'
import type { CredentialCheck, StorageProviderFactory } from '@commerce/storage'
import {
  makeS3CompatClient,
  type S3CompatDeps,
  S3CompatProvider,
} from '@commerce/storage-s3-compat'

export type S3Config = {
  accessKeyId: string
  secretAccessKey: string
  region: string
  bucket: string
  /**
   * Where objects are readable: left blank, the bucket's own virtual-hosted-style URL
   * (`https://<bucket>.s3.<region>.amazonaws.com`); set it to a CloudFront domain once one
   * is in front of the bucket.
   */
  publicBaseUrl?: string | undefined
  /** Objects are written under `<pathPrefix>/...` instead of at the bucket root. */
  pathPrefix?: string | undefined
  /** Override the S3 endpoint (tests, or a non-default AWS partition). */
  endpoint?: string | undefined
}

/** The object `verifyCredentials` writes, reads back and deletes. Never left behind on success. */
const TEST_OBJECT_KEY = '.waimers-connection-test'
const TEST_OBJECT_BODY = new TextEncoder().encode('waimers connection test')

export const defaultS3PublicBaseUrl = (bucket: string, region: string) =>
  `https://${bucket}.s3.${region}.amazonaws.com`

/**
 * Amazon S3. Real S3 (unlike R2) needs virtual-hosted-style addressing and a real AWS
 * region, so it builds its own client instead of reusing R2's endpoint construction; the
 * rest (presigned PUT, public URL, put/get/delete) comes straight from `S3CompatProvider`.
 */
export class S3StorageProvider extends S3CompatProvider {
  readonly id = 's3'
  readonly label = 'Amazon S3'

  constructor(config: S3Config, deps: S3CompatDeps = {}) {
    const client =
      deps.client ??
      makeS3CompatClient({
        region: config.region,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
      })
    super(
      client,
      {
        bucket: config.bucket,
        publicBaseUrl:
          config.publicBaseUrl?.trim() || defaultS3PublicBaseUrl(config.bucket, config.region),
        keyPrefix: config.pathPrefix,
      },
      deps,
    )
  }

  /**
   * Puts a tiny object, heads it to confirm it landed, then deletes it — proving the IAM
   * user actually has `s3:PutObject`, `s3:GetObject` (HeadObject reuses the same permission)
   * and `s3:DeleteObject` on this bucket, not just that the keys parse. Never left on the
   * bucket: the delete runs even when the head check failed, and always runs in a `finally`.
   */
  async verifyCredentials(): Promise<CredentialCheck> {
    try {
      await this.put({ key: TEST_OBJECT_KEY, body: TEST_OBJECT_BODY, contentType: 'text/plain' })
    } catch (err) {
      return { ok: false, message: describeS3Error(this.bucket, err) }
    }
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: `${this.keyPrefix}${TEST_OBJECT_KEY}` }),
      )
      return {
        ok: true,
        message: `Connected to bucket "${this.bucket}". Put, head and delete all worked.`,
      }
    } catch (err) {
      return { ok: false, message: describeS3Error(this.bucket, err) }
    } finally {
      await this.delete(TEST_OBJECT_KEY).catch(() => {
        // Best-effort cleanup: a failed delete here doesn't change the put/head verdict above,
        // and a leftover ~24-byte test object is harmless either way.
      })
    }
  }
}

function describeS3Error(bucket: string, err: unknown): string {
  const name = err instanceof Error ? err.name : 'Error'
  if (name === 'NoSuchBucket') {
    return `Bucket "${bucket}" does not exist in this region on this account.`
  }
  if (name === 'InvalidAccessKeyId') {
    return 'AWS rejected the access key ID. Double check it was copied in full.'
  }
  if (name === 'SignatureDoesNotMatch') {
    return 'AWS rejected the secret access key. Re-paste it — it is only shown once when the IAM user is created.'
  }
  if (name === 'AccessDenied' || name === '403') {
    return `AWS accepted the keys but refused the request. Check the IAM policy grants s3:PutObject, s3:GetObject and s3:DeleteObject on "${bucket}/*".`
  }
  if (name === 'PermanentRedirect' || name === 'AuthorizationHeaderMalformed') {
    return `This bucket is not in the region you entered. Check the bucket's region in the S3 console.`
  }
  return `Could not reach S3: ${err instanceof Error ? err.message : String(err)}`
}

function stringField(raw: Record<string, unknown>, key: string): string {
  const v = raw[key]
  return typeof v === 'string' ? v.trim() : ''
}

export const s3Factory: StorageProviderFactory<S3Config> = {
  id: 's3',
  label: 'Amazon S3',
  fields: [
    { key: 'accessKeyId', label: 'Access key ID', required: true },
    {
      key: 'secretAccessKey',
      label: 'Secret access key',
      secret: true,
      required: true,
      help: 'From the IAM user created for this bucket. Shown once — paste it right after creating the access key.',
    },
    {
      key: 'region',
      label: 'Region',
      required: true,
      help: 'The AWS region the bucket was created in, e.g. ap-south-1.',
    },
    { key: 'bucket', label: 'Bucket', required: true },
    {
      key: 'publicBaseUrl',
      label: 'Public URL / CloudFront domain',
      help: "Leave blank to use the bucket's own S3 URL. Set this once a CloudFront distribution is in front of the bucket.",
    },
    {
      key: 'pathPrefix',
      label: 'Path prefix',
      help: 'Optional folder inside the bucket, e.g. waimers, so this store never collides with anything else already in the bucket.',
    },
  ],
  validateConfig(raw) {
    const r = (raw ?? {}) as Record<string, unknown>
    const config: S3Config = {
      accessKeyId: stringField(r, 'accessKeyId'),
      secretAccessKey: stringField(r, 'secretAccessKey'),
      region: stringField(r, 'region'),
      bucket: stringField(r, 'bucket'),
      publicBaseUrl: stringField(r, 'publicBaseUrl') || undefined,
      pathPrefix: stringField(r, 'pathPrefix').replace(/^\/|\/$/g, '') || undefined,
    }
    const errors: string[] = []
    for (const k of ['accessKeyId', 'secretAccessKey', 'region', 'bucket'] as const) {
      if (!config[k]) errors.push(`${k} is required`)
    }
    if (config.publicBaseUrl && !/^https?:\/\//.test(config.publicBaseUrl)) {
      errors.push('publicBaseUrl must start with https://')
    }
    return errors.length ? { ok: false, errors } : { ok: true, config }
  },
  create: (config) => new S3StorageProvider(config),
}
