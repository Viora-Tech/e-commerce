import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import {
  type Message,
  type NotificationChannel,
  type NotificationChannelFactory,
  renderEmail,
  type SendResult,
} from '@commerce/notifications'

export type SesConfig = {
  region: string
  accessKeyId: string
  secretAccessKey: string
  fromEmail: string
  fromName?: string | undefined
}

/** The one SDK call we make, so tests can swap the client for a recorder. */
export type SesClientLike = {
  send(command: SendEmailCommand): Promise<{ MessageId?: string | undefined }>
}

export function formatFrom(config: SesConfig): string {
  return config.fromName ? `${config.fromName} <${config.fromEmail}>` : config.fromEmail
}

/** Transactional email through Amazon SES v2. Sandbox accounts can only mail verified addresses. */
export class SesChannel implements NotificationChannel {
  readonly id = 'ses'
  readonly label = 'Email (Amazon SES)'
  readonly requires = 'email' as const
  private readonly client: SesClientLike

  constructor(
    private readonly config: SesConfig,
    client?: SesClientLike,
  ) {
    this.client =
      client ??
      new SESv2Client({
        region: config.region,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      })
  }

  async send(message: Message): Promise<SendResult> {
    const to = message.to.email
    if (!to) return { ok: false, error: 'recipient has no email' }
    const body = renderEmail(message.template, message.data)
    try {
      const r = await this.client.send(
        new SendEmailCommand({
          FromEmailAddress: formatFrom(this.config),
          Destination: { ToAddresses: [to] },
          Content: {
            Simple: {
              Subject: { Data: body.subject, Charset: 'UTF-8' },
              Body: {
                Text: { Data: body.text, Charset: 'UTF-8' },
                Html: { Data: body.html, Charset: 'UTF-8' },
              },
            },
          },
        }),
      )
      return r.MessageId
        ? { ok: true, providerRef: r.MessageId }
        : { ok: false, error: 'SES returned no MessageId' }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
  ],
  validateConfig(raw) {
    const r = (raw ?? {}) as Partial<SesConfig>
    const errors: string[] = []
    if (!r.region) errors.push('region is required')
    if (!r.accessKeyId) errors.push('access key ID is required')
    if (!r.secretAccessKey) errors.push('secret access key is required')
    if (!r.fromEmail || !EMAIL.test(r.fromEmail)) errors.push('from address must be an email')
    if (errors.length > 0) return { ok: false, errors }
    return {
      ok: true,
      config: {
        region: r.region as string,
        accessKeyId: r.accessKeyId as string,
        secretAccessKey: r.secretAccessKey as string,
        fromEmail: r.fromEmail as string,
        fromName: r.fromName || undefined,
      },
    }
  },
  create: (config) => new SesChannel(config),
}
