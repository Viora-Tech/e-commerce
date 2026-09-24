import {
  type ChannelTemplate,
  type MarketingSend,
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
  /** WhatsApp Business Account id; needed to list approved templates for campaigns. */
  businessAccountId?: string | undefined
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
    case 'gift_card_issued':
      return [d.customerName, d.storeName, d.giftCard?.balanceLabel ?? '-', d.giftCard?.code ?? '-']
    case 'balance_request':
    case 'balance_reminder':
      return [d.customerName, d.storeName, n, d.balance?.dueLabel ?? '-', d.actionUrl ?? '-']
    case 'balance_received':
      return [d.storeName, n, d.totalLabel]
    case 'payment_reminder':
      return [d.customerName, d.storeName, n, d.totalLabel, d.orderUrl ?? '-']
    case 'unpaid_cancelled':
      return [d.customerName, d.storeName, n, d.totalLabel]
    case 'unpaid_cancel_notice':
      return [d.storeName, n, d.totalLabel, d.deadlineLabel ?? '-']
    case 'back_in_stock_confirm':
      return [d.backInStock?.productTitle ?? '-', d.backInStock?.confirmUrl ?? '-']
    case 'back_in_stock_alert':
      return [d.backInStock?.productTitle ?? '-', d.storeName, d.backInStock?.productUrl ?? '-']
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

/** Payload for a marketing send: a named approved template with its body variables. */
export function buildTemplatePayload(
  config: WhatsappConfig,
  template: { name: string; language: string; variables: string[] },
  to: string,
) {
  if (config.useTextMessages) {
    return {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: template.variables.map(clean).filter(Boolean).join(' ') || template.name },
    }
  }
  return {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: template.name,
      language: { code: template.language || config.templateLanguage },
      components: template.variables.length
        ? [
            {
              type: 'body',
              parameters: template.variables.map((text) => ({
                type: 'text',
                text: clean(text) || '-',
              })),
            },
          ]
        : [],
    },
  }
}

type GraphTemplate = {
  name?: string
  language?: string
  status?: string
  category?: string
  components?: { type?: string; text?: string }[]
}

/** Approved templates only: pending or rejected ones cannot be sent. */
export function approvedTemplates(data: GraphTemplate[]): ChannelTemplate[] {
  return data
    .filter((t) => t.status === 'APPROVED' && t.name && t.language)
    .map((t) => {
      const body = t.components?.find((c) => c.type === 'BODY')?.text ?? ''
      const placeholders = new Set(body.match(/\{\{\d+\}\}/g) ?? [])
      return {
        name: t.name as string,
        language: t.language as string,
        category: t.category ?? '',
        status: 'APPROVED',
        body,
        variableCount: placeholders.size,
      }
    })
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
    return this.post(buildPayload(this.config, message, to))
  }

  /** Broadcasts and automation steps: an approved template by name. */
  async sendMarketing(message: MarketingSend): Promise<SendResult> {
    if (message.kind !== 'whatsapp_template') {
      return { ok: false, error: 'WhatsApp sends approved templates only' }
    }
    const to = message.to.phone?.replace(/\D/g, '')
    if (!to) return { ok: false, error: 'recipient has no phone' }
    return this.post(buildTemplatePayload(this.config, message.template, to))
  }

  /** Approved templates on the business account, for the campaign picker. */
  async listTemplates(): Promise<ChannelTemplate[]> {
    if (!this.config.businessAccountId) return []
    const url = `${GRAPH_API}/${this.config.businessAccountId}/message_templates?limit=200&fields=name,language,status,category,components`
    const res = await this.fetchImpl(url, {
      method: 'GET',
      headers: { authorization: `Bearer ${this.config.accessToken}` },
    })
    const json = (await res.json().catch(() => ({}))) as {
      data?: GraphTemplate[]
      error?: { message?: string }
    }
    if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`)
    return approvedTemplates(json.data ?? [])
  }

  private async post(payload: unknown): Promise<SendResult> {
    try {
      const res = await this.fetchImpl(`${GRAPH_API}/${this.config.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.config.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
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
      key: 'businessAccountId',
      label: 'WhatsApp Business Account ID',
      help: 'Needed for Marketing: lists your approved templates for broadcasts and automations.',
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
        businessAccountId: r.businessAccountId?.trim() || undefined,
      },
    }
  },
  create: (config) => new WhatsappChannel(config),
}
