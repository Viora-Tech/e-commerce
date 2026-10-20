import {
  type Attachment,
  type MarketingSend,
  type Message,
  type NotificationChannel,
  renderEmail,
  type SendResult,
} from '@commerce/notifications'
import { formatMailbox } from '@commerce/notifications-ses/address'

/**
 * Email through Resend's REST API (`POST /emails`), with plain `fetch`: one call, so the
 * SDK would add a dependency and nothing else. Request and response shapes checked against
 * https://resend.com/docs/api-reference/emails/send-email and the errors reference.
 */

export const RESEND_API_URL = 'https://api.resend.com'

/** A send that has not answered in this long is treated as unreachable (and may fall back). */
const SEND_TIMEOUT_MS = 15_000

export type ResendConfig = {
  apiKey: string
  fromEmail: string
  fromName?: string | undefined
  /** Where customer replies go when From is an address nobody reads (the platform sender). */
  replyTo?: string | undefined
}

/** Lets the platform's own sender reuse this channel under its own id and label. */
export type ResendChannelOptions = {
  id?: string | undefined
  label?: string | undefined
  /** Tests pass a mock; defaults to the global `fetch`. */
  fetch?: typeof fetch | undefined
  /** Defaults to `RESEND_API_URL`. */
  baseUrl?: string | undefined
}

type ResendTag = { name: string; value: string }

/** The body of `POST /emails`, only the fields we send. */
type ResendEmail = {
  from: string
  to: string[]
  subject: string
  html: string
  text: string
  reply_to?: string
  headers?: Record<string, string>
  attachments?: { filename: string; content: string; content_type: string }[]
  tags?: ResendTag[]
}

/** Resend's error names that mean the provider or the account, not the message, failed. */
const PROVIDER_ERRORS: ReadonlySet<string> = new Set([
  'rate_limit_exceeded',
  'daily_quota_exceeded',
  'monthly_quota_exceeded',
  'application_error',
  'internal_server_error',
])

/** Tag values allow ASCII letters, digits, `_` and `-` only (Resend's rule), at most 256. */
const tagValue = (v: string) => v.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 256)

const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')

const attachmentsOf = (files: Attachment[] | undefined) =>
  files?.length
    ? {
        attachments: files.map((f) => ({
          filename: f.filename,
          content: toBase64(f.content),
          content_type: f.contentType,
        })),
      }
    : {}

/** Transactional and marketing email through Resend. The From domain must be verified there. */
export class ResendChannel implements NotificationChannel {
  readonly id: string
  readonly label: string
  readonly requires = 'email' as const
  private readonly fetch: typeof fetch
  private readonly baseUrl: string

  constructor(
    private readonly config: ResendConfig,
    options: ResendChannelOptions = {},
  ) {
    this.id = options.id ?? 'resend'
    this.label = options.label ?? 'Email (Resend)'
    this.fetch = options.fetch ?? globalThis.fetch
    this.baseUrl = options.baseUrl ?? RESEND_API_URL
  }

  async send(message: Message): Promise<SendResult> {
    const to = message.to.email
    if (!to) return { ok: false, error: 'recipient has no email' }
    const body = await renderEmail(message.template, message.data)
    return this.post({
      ...this.envelope(to),
      subject: body.subject,
      html: body.html,
      text: body.text,
      ...attachmentsOf(message.attachments),
      tags: [{ name: 'template', value: tagValue(message.template) }],
    })
  }

  /** Campaign and automation email, already rendered by the platform, with its unsubscribe headers. */
  async sendMarketing(message: MarketingSend): Promise<SendResult> {
    if (message.kind !== 'email') return { ok: false, error: 'Resend only sends email' }
    const to = message.to.email
    if (!to) return { ok: false, error: 'recipient has no email' }
    return this.post({
      ...this.envelope(to),
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.headers?.length
        ? { headers: Object.fromEntries(message.headers.map((h) => [h.name, h.value])) }
        : {}),
      tags: [{ name: 'kind', value: 'marketing' }],
    })
  }

  private envelope(to: string) {
    return {
      from: formatMailbox(this.config.fromName, this.config.fromEmail),
      to: [to],
      // Only when set: Resend would otherwise reply to From.
      ...(this.config.replyTo ? { reply_to: this.config.replyTo } : {}),
    }
  }

  private async post(email: ResendEmail): Promise<SendResult> {
    let res: Response
    try {
      res = await this.fetch(`${this.baseUrl}/emails`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(email),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      })
    } catch (err) {
      // No answer at all (DNS, socket, timeout): another provider may well get through.
      return {
        ok: false,
        error: `Resend unreachable: ${err instanceof Error ? err.message : String(err)}`,
        retryable: true,
      }
    }
    const json = (await res.json().catch(() => null)) as {
      id?: unknown
      name?: unknown
      message?: unknown
    } | null
    if (res.ok) {
      return typeof json?.id === 'string' && json.id
        ? { ok: true, providerRef: json.id }
        : { ok: false, error: 'Resend returned no id' }
    }
    const name = typeof json?.name === 'string' ? json.name : ''
    const detail = typeof json?.message === 'string' ? json.message : res.statusText
    const error = `Resend ${res.status}${name ? ` ${name}` : ''}: ${detail}`
    const retryable = res.status === 429 || res.status >= 500 || PROVIDER_ERRORS.has(name)
    return retryable ? { ok: false, error, retryable: true } : { ok: false, error }
  }
}
