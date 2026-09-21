/**
 * The notification contract. Channels (email, WhatsApp, SMS) implement it; the
 * worker renders a template and hands the result to every channel a store has
 * enabled. Channels never touch the database or the order.
 */

export type TemplateId = 'order_placed' | 'payment_received' | 'order_shipped'

export type Recipient = {
  email?: string | undefined
  /** E.164 without the plus, e.g. 919876543210. */
  phone?: string | undefined
  name?: string | undefined
}

/** Everything a template needs; built by the worker from the order row. */
export type TemplateData = {
  storeName: string
  orderNumber: number
  customerName: string
  totalLabel: string
  lines: { title: string; quantity: number; priceLabel: string }[]
  paymentMethodLabel: string
  /** Set on order_shipped when the carrier gave us one. */
  trackingUrl?: string | undefined
  /** Where the shopper can see the order (thank-you page). */
  orderUrl?: string | undefined
}

export type Message = {
  to: Recipient
  template: TemplateId
  data: TemplateData
}

export type SendResult = { ok: true; providerRef: string } | { ok: false; error: string }

export type NotificationChannel = {
  /** Stable id used in store settings and the notification table. Lowercase, no spaces. */
  readonly id: string
  readonly label: string
  /** Which recipient field this channel needs; the worker skips it when the order has none. */
  readonly requires: 'email' | 'phone'
  /** Never throws: transport errors come back as `{ ok: false }` so the worker can retry. */
  send(message: Message): Promise<SendResult>
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
