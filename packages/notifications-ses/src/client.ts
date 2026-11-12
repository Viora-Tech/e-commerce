import { SESv2Client } from '@aws-sdk/client-sesv2'

/**
 * Every SES call ends. Without these the SDK waits forever on a connection that stopped
 * answering, and the notification job that made it holds its worker slot for good instead of
 * failing and being retried. Same shape as `S3_COMPAT_TIMEOUTS` in `@commerce/storage-s3-compat`.
 */
const SES_TIMEOUTS = {
  connectionTimeout: 5_000,
  requestTimeout: 15_000,
}

export type SesClientConfig = {
  region: string
  accessKeyId: string
  secretAccessKey: string
  /** Tests only: a local endpoint and shorter timeouts. */
  endpoint?: string | undefined
  timeouts?: Partial<typeof SES_TIMEOUTS> | undefined
  maxAttempts?: number | undefined
}

/** The SES v2 client both the sender and the domain set-up use. */
export function makeSesClient(config: SesClientConfig): SESv2Client {
  return new SESv2Client({
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    ...(config.maxAttempts ? { maxAttempts: config.maxAttempts } : {}),
    requestHandler: {
      ...SES_TIMEOUTS,
      ...config.timeouts,
      // Without this a request past `requestTimeout` only logs a warning and carries on waiting.
      throwOnRequestTimeout: true,
    },
  })
}
