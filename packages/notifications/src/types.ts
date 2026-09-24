/**
 * The notification contract. Channels (email, WhatsApp, SMS) implement it; the
 * worker renders a template and hands the result to every channel a store has
 * enabled. Channels never touch the database or the order.
 */

export type TemplateId =
  | 'order_placed'
  | 'payment_received'
  | 'order_shipped'
  | 'draft_invoice'
  | 'checkout_recovery'
  /** A copy of an order document (invoice, credit note) sent on request, with the file attached. */
  | 'document_copy'
  /** Storefront account sign-in code. Sent straight away, never queued: it lives ten minutes. */
  | 'login_code'
  /** A gift card was issued (bought or sent by the merchant); carries the code. Email only. */
  | 'gift_card_issued'
  /** A deposit pre-order's balance is due; carries the pay-balance link. */
  | 'balance_request'
  /** The same, again, while the balance is still unpaid. */
  | 'balance_reminder'
  /** The balance was paid; the order will ship. */
  | 'balance_received'
  /** A manual UPI / bank transfer order is still unpaid; links to the payment details. Sent by the merchant. */
  | 'payment_reminder'
  /** To the MERCHANT: an unpaid transfer order will be cancelled automatically. Email only. */
  | 'unpaid_cancel_notice'
  /** A manual UPI / bank transfer order was cancelled for non-payment. */
  | 'unpaid_cancelled'

export type Recipient = {
  email?: string | undefined
  /** E.164 without the plus, e.g. 919876543210. */
  phone?: string | undefined
  name?: string | undefined
}

/** Everything a template needs; built by the worker from the order row. */
export type TemplateData = {
  storeName: string
  /** Absent for messages about a cart that is not an order yet. */
  orderNumber?: number | undefined
  customerName: string
  totalLabel: string
  lines: { title: string; quantity: number; priceLabel: string }[]
  paymentMethodLabel: string
  /** Set on order_shipped when the carrier gave us one. */
  trackingUrl?: string | undefined
  /** Courier tracking number, printed so the shopper can quote it. */
  waybill?: string | undefined
  /** Where the shopper can see the order (thank-you page). */
  orderUrl?: string | undefined
  /** Pay link on a draft invoice, or the restore link on an abandoned cart. */
  actionUrl?: string | undefined
  /** For document_copy: what is attached, e.g. "tax invoice INV/25-26/0007". */
  documentLabel?: string | undefined
  /** Extra links installed apps add, e.g. "Download invoice". */
  links?: { label: string; url: string }[] | undefined
  /** For balance messages: what is still owed, what was paid up front, and when it must be paid by. */
  balance?:
    | {
        dueLabel: string
        depositLabel: string
        payByLabel?: string | undefined
        /** Shown when the store keeps the deposit if the balance is never paid. */
        depositNonRefundable?: boolean | undefined
      }
    | undefined
  /** For unpaid_cancel_notice: when the order will be cancelled. */
  deadlineLabel?: string | undefined
  /** For login_code: the one-time code. */
  code?: string | undefined
  /** For gift_card_issued: the code in full (the only place it is ever shown) and its terms. */
  giftCard?:
    | {
        code: string
        balanceLabel: string
        expiresLabel?: string | undefined
        message?: string | undefined
      }
    | undefined
}

/** A file sent with an email. Channels that cannot carry files ignore it. */
export type Attachment = {
  filename: string
  contentType: string
  content: Uint8Array
}

export type Message = {
  to: Recipient
  template: TemplateId
  data: TemplateData
  attachments?: Attachment[] | undefined
}

export type SendResult = { ok: true; providerRef: string } | { ok: false; error: string }

/**
 * A marketing send: an email the platform already rendered (campaigns,
 * automations), or an approved WhatsApp template by name. Unlike `Message`
 * the channel does no templating of its own.
 */
export type MarketingSend =
  | {
      kind: 'email'
      to: Recipient
      subject: string
      html: string
      text: string
      /** Extra headers, e.g. List-Unsubscribe and List-Unsubscribe-Post. */
      headers?: { name: string; value: string }[] | undefined
    }
  | {
      kind: 'whatsapp_template'
      to: Recipient
      template: { name: string; language: string; variables: string[] }
    }

/** An approved message template, as the provider reports it (WhatsApp). */
export type ChannelTemplate = {
  name: string
  language: string
  /** MARKETING, UTILITY or AUTHENTICATION on WhatsApp. */
  category: string
  status: string
  /** Body text with {{1}}-style placeholders, for the picker's preview. */
  body: string
  variableCount: number
}

export type NotificationChannel = {
  /** Stable id used in store settings and the notification table. Lowercase, no spaces. */
  readonly id: string
  readonly label: string
  /** Which recipient field this channel needs; the worker skips it when the order has none. */
  readonly requires: 'email' | 'phone'
  /** Never throws: transport errors come back as `{ ok: false }` so the worker can retry. */
  send(message: Message): Promise<SendResult>
  /** Marketing sends; channels without it cannot carry campaigns or automations. Never throws. */
  sendMarketing?(message: MarketingSend): Promise<SendResult>
  /** Approved templates the channel may send (WhatsApp). Throws on transport errors. */
  listTemplates?(): Promise<ChannelTemplate[]>
}

/** Same shape as the payments ProviderField; copied so this package stays dependency-free. */
export type ProviderField = {
  key: string
  label: string
  /** Encrypted at rest and masked in the UI. */
  secret?: boolean
  required?: boolean
  multiline?: boolean
  /** `boolean` renders a checkbox and stores 'true' | 'false'. Defaults to text. */
  type?: 'text' | 'boolean'
  help?: string
}

export type NotificationChannelFactory<Config> = {
  id: string
  label: string
  /** What the merchant fills in Settings > Notifications. Drives the form. */
  fields: ProviderField[]
  validateConfig(raw: unknown): { ok: true; config: Config } | { ok: false; errors: string[] }
  create(config: Config): NotificationChannel
}
