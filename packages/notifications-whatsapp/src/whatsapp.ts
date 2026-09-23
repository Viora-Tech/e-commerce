import {
  type Message,
  type NotificationChannel,
  type NotificationChannelFactory,
  renderWhatsapp,
  type SendResult,
  type TemplateData,
  type TemplateId,
} from '@commerce/notifications'

export type WhatsappConfig = {
  phoneNumberId: string
  accessToken: string
  /** Language code of the approved templates, e.g. en or en_US. */
  templateLanguage: string
  /**
   * Send plain text instead of approved templates. Only works inside the 24h
   * customer-service window or with test numbers; for development.
   */
  useTextMessages: boolean
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>

export const GRAPH_API = 'https://graph.facebook.com/v22.0'

/**
 * Body parameters for each approved template, in the order the template's
 * {{1}} {{2}} ... placeholders expect. Merchants create templates named after
 * the TemplateId in Meta Business Manager with matching placeholders.
 */
export function templateParams(template: TemplateId, d: TemplateData): string[] {
  const n = String(d.orderNumber)
  switch (template) {
    case 'order_placed':
      return [d.customerName, d.storeName, n, d.totalLabel]
    case 'payment_received':
      return [d.totalLabel, d.storeName, n]
    case 'order_shipped':
      return [d.storeName, n, d.trackingUrl ?? '-']
    case 'draft_invoice':
      return [d.customerName, n, d.totalLabel, d.actionUrl ?? '-']
    case 'checkout_recovery':
      return [d.customerName, d.storeName, d.totalLabel, d.actionUrl ?? '-']
    case 'document_copy':
      return [d.customerName, d.storeName, n, d.links?.[0]?.url ?? '-']
    case 'login_code':
      return [d.code ?? '-', d.storeName]
  }
}

/** WhatsApp placeholders may not contain newlines, tabs or 4+ spaces. */
const clean = (s: string): string => s.replace(/\s+/g, ' ').trim()

export function buildPayload(config: WhatsappConfig, message: Message, to: string) {
  if (config.useTextMessages) {
    return {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: renderWhatsapp(message.template, message.data).text },
    }
  }
  return {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: message.template,
      language: { code: config.templateLanguage },
      components: [
        {
          type: 'body',
          parameters: templateParams(message.template, message.data).map((text) => ({
            type: 'text',
            text: clean(text),
          })),
        },
      ],
    },
  }
}

/** Meta WhatsApp Cloud API. One HTTP call per message; nothing else. */
export class WhatsappChannel implements NotificationChannel {
  readonly id = 'whatsapp'
  readonly label = 'WhatsApp (Meta Cloud API)'
  readonly requires = 'phone' as const
  private readonly fetchImpl: FetchLike

  constructor(
    private readonly config: WhatsappConfig,
    fetchImpl?: FetchLike,
  ) {
    this.fetchImpl = fetchImpl ?? ((input, init) => fetch(input, init))
  }

  async send(message: Message): Promise<SendResult> {
    const to = message.to.phone?.replace(/\D/g, '')
    if (!to) return { ok: false, error: 'recipient has no phone' }
    try {
      const res = await this.fetchImpl(`${GRAPH_API}/${this.config.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.config.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(buildPayload(this.config, message, to)),
      })
      const json = (await res.json().catch(() => ({}))) as {
        messages?: { id: string }[]
        error?: { message?: string }
      }
      if (!res.ok) return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` }
      const id = json.messages?.[0]?.id
      return id ? { ok: true, providerRef: id } : { ok: false, error: 'no message id in response' }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}

export const whatsappFactory: NotificationChannelFactory<WhatsappConfig> = {
  id: 'whatsapp',
  label: 'WhatsApp (Meta Cloud API)',
  fields: [
    {
      key: 'phoneNumberId',
      label: 'Phone number ID',
      required: true,
      help: 'From Meta for Developers > WhatsApp > API setup.',
    },
    { key: 'accessToken', label: 'Access token', secret: true, required: true },
    {
      key: 'templateLanguage',
      label: 'Template language',
      help: 'Language code of your approved templates. Defaults to en.',
    },
    {
      key: 'useTextMessages',
      label: 'Send plain text instead of templates (test mode)',
      type: 'boolean',
      help: 'Only reaches numbers that messaged you in the last 24h or test numbers.',
    },
  ],
  validateConfig(raw) {
    const r = (raw ?? {}) as Record<string, string | undefined>
    const errors: string[] = []
    if (!r.phoneNumberId || !/^\d+$/.test(r.phoneNumberId)) {
      errors.push('phone number ID should be numeric')
    }
    if (!r.accessToken) errors.push('access token is required')
    if (errors.length > 0) return { ok: false, errors }
    return {
      ok: true,
      config: {
        phoneNumberId: r.phoneNumberId as string,
        accessToken: r.accessToken as string,
        templateLanguage: r.templateLanguage?.trim() || 'en',
        useTextMessages: r.useTextMessages === 'true',
      },
    }
  },
  create: (config) => new WhatsappChannel(config),
}
