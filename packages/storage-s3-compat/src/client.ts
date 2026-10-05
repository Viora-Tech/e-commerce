import { type PutObjectCommand, S3Client, type S3ClientConfig } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/** How long a presigned PUT stays valid. Long enough for a slow mobile upload, short enough to be useless later. */
export const S3_COMPAT_PRESIGN_SECONDS = 15 * 60

export type SignFn = (
  client: S3Client,
  command: PutObjectCommand,
  expiresIn: number,
) => Promise<string>

/**
 * `content-type` is signed as well as `content-length`: unsigned, the browser could PUT
 * `text/html` (or SVG) under a key presigned for `image/png`, and the bucket would serve it
 * as a page from the media domain.
 */
const PRESIGN_SIGNED_HEADERS = new Set(['content-type', 'content-length'])

export const defaultSign: SignFn = (client, command, expiresIn) =>
  getSignedUrl(client, command, { expiresIn, signableHeaders: PRESIGN_SIGNED_HEADERS })

export type S3CompatDeps = {
  /** Injected in tests; production builds a real client. */
  client?: S3Client | undefined
  /** Injected in tests so no signature maths runs. */
  sign?: SignFn | undefined
}

/**
 * Every request ends. Without these the SDK waits forever: a PUT whose body stopped
 * part way never gets a response, and the import that made it holds its slot for good.
 * `requestTimeout` runs until the response starts, so it covers sending the body (a
 * 100 MB buffered video included) but not reading a large `get`.
 */
export const S3_COMPAT_TIMEOUTS = {
  connectionTimeout: 10_000,
  requestTimeout: 5 * 60_000,
}

export type S3CompatClientConfig = {
  region: string
  accessKeyId: string
  secretAccessKey: string
  /** Override the default AWS endpoint (R2's account endpoint, a test double, a jurisdiction endpoint). */
  endpoint?: string | undefined
  /** R2 and most other S3-compatible stores need the older path style; real S3 uses virtual-hosted style. */
  forcePathStyle?: boolean | undefined
  /** Overrides `S3_COMPAT_TIMEOUTS` (tests). */
  timeouts?: Partial<typeof S3_COMPAT_TIMEOUTS> | undefined
  /** The SDK's attempts per request (its default is 3). */
  maxAttempts?: number | undefined
}

export function makeS3CompatClient(config: S3CompatClientConfig): S3Client {
  const opts: S3ClientConfig = {
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    ...(config.forcePathStyle ? { forcePathStyle: true } : {}),
    ...(config.maxAttempts ? { maxAttempts: config.maxAttempts } : {}),
    requestHandler: {
      ...S3_COMPAT_TIMEOUTS,
      ...config.timeouts,
      // Without this a request past `requestTimeout` only logs a warning and carries on waiting.
      throwOnRequestTimeout: true,
    },
  }
  return new S3Client(opts)
}
