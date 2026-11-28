import { SendEmailCommand } from '@aws-sdk/client-sesv2'
import {
  type MarketingSend,
  type Message,
  type NotificationChannel,
  type NotificationChannelFactory,
  renderEmail,
  type SendResult,
} from '@commerce/notifications'
import { formatMailbox } from './address'
import { makeSesClient } from './client'

export type SesConfig = {
  region: string
  accessKeyId: string
  secretAccessKey: string
  fromEmail: string
  fromName?: string | undefined
  /** Where customer replies go when From is an address nobody reads (the platform sender). */
  replyTo?: string | undefined
  /**
   * SES configuration set named on every send, so bounces and complaints reach its event
   * destination (SNS). It must exist in the account, or SES refuses the send.
   */
  configurationSetName?: string | undefined
  /** Message tags (`EmailTags`), echoed back on bounce and complaint events, e.g. `store-id`. */
  tags?: Readonly<Record<string, string>> | undefined
  /**
   * A store's own account: the SNS topic its configuration set publishes bounces and
   * complaints to. The platform's webhook accepts that topic for this store only.
   */
  eventsTopicArn?: string | undefined
}

/** The tag every store send carries, so a bounce event names its store. */
export const STORE_TAG = 'store-id'

/** Lets the platform's own sender reuse this channel under its own id and label. */
export type SesChannelOptions = { id?: string | undefined; label?: string | undefined }

/** The one SDK call we make, so tests can swap the client for a recorder. */
export type SesClientLike = {
  send(command: SendEmailCommand): Promise<{ MessageId?: string | undefined }>
}

export function formatFrom(config: SesConfig): string {
  return formatMailbox(config.fromName, config.fromEmail)
}

/** SES errors that say the account or the service, not the message, is the problem. */
const PROVIDER_ERRORS: ReadonlySet<string> = new Set([
  'ThrottlingException',
  'TooManyRequestsException',
  'LimitExceededException',
  'SendingPausedException',
  'AccountSuspendedException',
  'InternalFailure',
  'ServiceUnavailable',
  'ServiceUnavailableException',
  'TimeoutError',
])

/** Node socket errors: the request never got an answer. */
const NETWORK_CODES: ReadonlySet<string> = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
])

type SdkError = {
  name?: unknown
  code?: unknown
  $retryable?: unknown
  $fault?: unknown
  $metadata?: { httpStatusCode?: unknown }
}

/**
 * True when another provider could deliver what SES could not. Only clear signals count
 * (the SDK's own `$retryable`/`$fault`, a 429/5xx, a known account or throttling error, a
 * socket error); an unknown error is not retried elsewhere.
 */
function sesRetryable(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as SdkError
  const status = e.$metadata?.httpStatusCode
  return Boolean(
    e.$retryable ||
      e.$fault === 'server' ||
      (typeof status === 'number' && (status === 429 || status >= 500)) ||
      (typeof e.name === 'string' && PROVIDER_ERRORS.has(e.name)) ||
      (typeof e.code === 'string' && NETWORK_CODES.has(e.code)),
  )
}

/** A thrown SDK error as a failed send; `retryable` only when it is. */
function sesFailure(err: unknown): SendResult {
  const error = err instanceof Error ? err.message : String(err)
  return sesRetryable(err) ? { ok: false, error, retryable: true } : { ok: false, error }
}

/** `ReplyToAddresses`, only when set: SES would otherwise reply to From. */
const replyTo = (config: SesConfig) =>
  config.replyTo ? { ReplyToAddresses: [config.replyTo] } : {}

/** SES tag names and values allow only letters, digits, `_`, `-`, `.` and `@` (max 256). */
const TAG_SAFE = /^[A-Za-z0-9_.@-]{1,256}$/

/** The configuration set and tags, only when set (both route bounce and complaint events). */
function eventRouting(config: SesConfig) {
  const tags = Object.entries(config.tags ?? {})
    .filter(([name, value]) => TAG_SAFE.test(name) && TAG_SAFE.test(value))
    .map(([Name, Value]) => ({ Name, Value }))
  return {
    ...(config.configurationSetName ? { ConfigurationSetName: config.configurationSetName } : {}),
    ...(tags.length > 0 ? { EmailTags: tags } : {}),
  }
}

/** Transactional email through Amazon SES v2. Sandbox accounts can only mail verified addresses. */
export class SesChannel implements NotificationChannel {
  readonly id: string
  readonly label: string
  readonly requires = 'email' as const
  private readonly client: SesClientLike

  constructor(
    private readonly config: SesConfig,
    client?: SesClientLike,
    options: SesChannelOptions = {},
  ) {
    this.id = options.id ?? 'ses'
    this.label = options.label ?? 'Email (Amazon SES)'
    this.client = client ?? makeSesClient(config)
  }

  /** The same channel with the store's tag on every send (bounces then name the store). */
  forStore(storeId: string): SesChannel {
    return new SesChannel(
      { ...this.config, tags: { ...this.config.tags, [STORE_TAG]: storeId } },
      this.client,
      { id: this.id, label: this.label },
    )
  }

  async send(message: Message): Promise<SendResult> {
    const to = message.to.email
    if (!to) return { ok: false, error: 'recipient has no email' }
    const body = await renderEmail(message.template, message.data)
    try {
      const r = await this.client.send(
        new SendEmailCommand({
          FromEmailAddress: formatFrom(this.config),
          Destination: { ToAddresses: [to] },
          ...replyTo(this.config),
          ...eventRouting(this.config),
          Content: {
            Simple: {
              Subject: { Data: body.subject, Charset: 'UTF-8' },
              Body: {
                Text: { Data: body.text, Charset: 'UTF-8' },
                Html: { Data: body.html, Charset: 'UTF-8' },
              },
              // SES v2 carries files on a simple message; no hand-built MIME.
              ...(message.attachments?.length
                ? {
                    Attachments: message.attachments.map((f) => ({
                      FileName: f.filename,
                      ContentType: f.contentType,
                      RawContent: f.content,
                      ContentDisposition: 'ATTACHMENT' as const,
                      // Without this SES defaults to SEVEN_BIT and binary files (PDFs) arrive blank.
                      ContentTransferEncoding: 'BASE64' as const,
                    })),
                  }
                : {}),
            },
          },
        }),
      )
      return r.MessageId
        ? { ok: true, providerRef: r.MessageId }
        : { ok: false, error: 'SES returned no MessageId' }
    } catch (err) {
      return sesFailure(err)
    }
  }

  /** Campaign and automation email, already rendered by the platform, with its unsubscribe headers. */
  async sendMarketing(message: MarketingSend): Promise<SendResult> {
    if (message.kind !== 'email') return { ok: false, error: 'SES only sends email' }
    const to = message.to.email
    if (!to) return { ok: false, error: 'recipient has no email' }
    try {
      const r = await this.client.send(
        new SendEmailCommand({
          FromEmailAddress: formatFrom(this.config),
          Destination: { ToAddresses: [to] },
          ...replyTo(this.config),
          ...eventRouting(this.config),
          Content: {
            Simple: {
              Subject: { Data: message.subject, Charset: 'UTF-8' },
              Body: {
                Text: { Data: message.text, Charset: 'UTF-8' },
                Html: { Data: message.html, Charset: 'UTF-8' },
              },
              ...(message.headers?.length
                ? { Headers: message.headers.map((h) => ({ Name: h.name, Value: h.value })) }
                : {}),
            },
          },
        }),
      )
      return r.MessageId
        ? { ok: true, providerRef: r.MessageId }
        : { ok: false, error: 'SES returned no MessageId' }
    } catch (err) {
      return sesFailure(err)
    }
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** SES configuration set names: letters, digits, `_` and `-`, up to 64. */
const CONFIG_SET = /^[A-Za-z0-9_-]{1,64}$/
const SNS_TOPIC_ARN = /^arn:aws:sns:[a-z]{2}(-[a-z]+)+-\d:\d{12}:[A-Za-z0-9_-]{1,256}$/

export const sesFactory: NotificationChannelFactory<SesConfig> = {
  id: 'ses',
  label: 'Email (Amazon SES)',
  fields: [
    { key: 'region', label: 'AWS region', required: true, help: 'e.g. ap-south-1' },
    { key: 'accessKeyId', label: 'Access key ID', required: true },
    { key: 'secretAccessKey', label: 'Secret access key', secret: true, required: true },
    {
      key: 'fromEmail',
      label: 'From address',
      required: true,
      help: 'Must be verified in SES (the address or its domain).',
    },
    { key: 'fromName', label: 'From name', help: 'e.g. Waimers' },
    {
      key: 'configurationSetName',
      label: 'Configuration set',
      help: 'For bounces and complaints: a configuration set whose event destination is the SNS topic below.',
    },
    {
      key: 'eventsTopicArn',
      label: 'SNS topic ARN',
      help: 'The topic that configuration set sends bounces and complaints to, subscribed to the address shown on this page.',
    },
  ],
  validateConfig(raw) {
    const r = (raw ?? {}) as Partial<SesConfig>
    const errors: string[] = []
    if (!r.region) errors.push('region is required')
    if (!r.accessKeyId) errors.push('access key ID is required')
    if (!r.secretAccessKey) errors.push('secret access key is required')
    if (!r.fromEmail || !EMAIL.test(r.fromEmail)) errors.push('from address must be an email')
    const configurationSetName = r.configurationSetName?.trim() || undefined
    const eventsTopicArn = r.eventsTopicArn?.trim() || undefined
    if (configurationSetName && !CONFIG_SET.test(configurationSetName)) {
      errors.push('configuration set: letters, digits, _ and - only')
    }
    if (eventsTopicArn && !SNS_TOPIC_ARN.test(eventsTopicArn)) {
      errors.push('SNS topic ARN should look like arn:aws:sns:ap-south-1:123456789012:ses-events')
    }
    if (eventsTopicArn && !configurationSetName) {
      errors.push('the SNS topic needs the configuration set that publishes to it')
    }
    if (errors.length > 0) return { ok: false, errors }
    return {
      ok: true,
      config: {
        region: r.region as string,
        accessKeyId: r.accessKeyId as string,
        secretAccessKey: r.secretAccessKey as string,
        fromEmail: r.fromEmail as string,
        fromName: r.fromName || undefined,
        configurationSetName,
        eventsTopicArn,
      },
    }
  },
  create: (config) => new SesChannel(config),
}
