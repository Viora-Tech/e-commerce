import { customer, marketingMessage, type StoreTx, store } from '@commerce/db'
import { formatMoney } from '@commerce/money'
import type { NotificationChannel, NotificationRegistry, SendResult } from '@commerce/notifications'
import { eq } from 'drizzle-orm'
import { type ConsentChannel, hasMarketingConsent } from '../privacy/client'
import { storeNotificationChannels } from '../sender-email/channels'
import { StoreAddressSchema } from '../settings/general'
import {
  type EmailBlock,
  type EmailCartLine,
  type MergeValues,
  renderMarketingEmail,
} from './email'
import {
  clickToken,
  clickUrl,
  messageToken,
  oneClickUnsubscribeUrl,
  openPixelUrl,
  unsubscribeToken,
  unsubscribeUrl,
} from './tokens'

/** What every marketing send needs from its host (worker or admin API). */
export type MarketingDeps = {
  registry: NotificationRegistry
  settingsSecret: string
  /** Public storefront origin: tracking links, unsubscribe and product links live there. */
  storefrontUrl: string
  /** Tests inject channels instead of resolving them from store settings. */
  channels?: NotificationChannel[] | undefined
}

export type MarketingChannels = {
  email: NotificationChannel | null
  whatsapp: NotificationChannel | null
}

/**
 * The store's channels that can carry marketing: the first enabled email
 * channel and the first enabled phone channel that implement `sendMarketing`.
 */
export async function marketingChannels(
  tx: StoreTx,
  storeId: string,
  deps: MarketingDeps,
): Promise<MarketingChannels> {
  const channels =
    deps.channels ??
    (await storeNotificationChannels(tx, storeId, {
      registry: deps.registry,
      settingsSecret: deps.settingsSecret,
    }))
  const capable = channels.filter((c) => typeof c.sendMarketing === 'function')
  return {
    email: capable.find((c) => c.requires === 'email') ?? null,
    whatsapp: capable.find((c) => c.requires === 'phone') ?? null,
  }
}

export type StoreSender = { storeName: string; storeAddress: string | undefined }

export async function storeSender(tx: StoreTx, storeId: string): Promise<StoreSender> {
  const [s] = await tx
    .select({ name: store.name, address: store.address })
    .from(store)
    .where(eq(store.id, storeId))
  const a = StoreAddressSchema.safeParse(s?.address ?? {})
  const address = a.success
    ? [a.data.line1, a.data.line2, a.data.city, a.data.state, a.data.pincode]
        .filter(Boolean)
        .join(', ')
    : ''
  return { storeName: s?.name ?? '', storeAddress: address || undefined }
}

/** Formats paise as INR for marketing email/WhatsApp merge tags. */
export function inr(paise: number): string {
  return formatMoney(paise, 'INR')
}

/** First name for `{first_name}`; "there" reads naturally in "Hi there". */
export function firstName(name: string | null | undefined): string {
  return name?.trim().split(/\s+/)[0] || 'there'
}

/**
 * The consent gate every marketing send passes, right before the provider is
 * called. A marketing message goes only to a customer who said yes on that
 * channel and has not unsubscribed or been erased; someone who only left a
 * contact at checkout (no customer) gets nothing. `transactional` is for an
 * update about the shopper's own order (the COD confirmation), which needs no
 * marketing consent. Checked here, not only when the audience is chosen, so
 * a withdrawal between queueing and sending always wins.
 */
async function mayMarket(
  tx: StoreTx,
  input: {
    customerId: string | null
    channel: ConsentChannel
    transactional?: boolean | undefined
  },
): Promise<boolean> {
  if (input.transactional) return true
  if (!input.customerId) return false
  const [row] = await tx
    .select({
      acceptsMarketing: customer.acceptsMarketing,
      acceptsWhatsapp: customer.acceptsWhatsapp,
      acceptsSms: customer.acceptsSms,
      unsubscribedAt: customer.unsubscribedAt,
      anonymisedAt: customer.anonymisedAt,
    })
    .from(customer)
    .where(eq(customer.id, input.customerId))
  return hasMarketingConsent(row, input.channel)
}

/** Why a send was refused at the gate; stored on the message row. */
const NO_CONSENT = 'no_consent'

async function skipForConsent(tx: StoreTx, messageId: string): Promise<SendResult> {
  await tx
    .update(marketingMessage)
    .set({ status: 'skipped', error: NO_CONSENT })
    .where(eq(marketingMessage.id, messageId))
  return { ok: false, error: NO_CONSENT }
}

export type EmailSendInput = {
  messageId: string
  to: string
  /** The recipient's customer; consent is checked on it. Null (a bare checkout contact) is never sent marketing. */
  customerId: string | null
  subject: string
  previewText: string
  blocks: EmailBlock[]
  merge: MergeValues
  cart?: { lines: EmailCartLine[]; totalLabel: string } | undefined
  /** Links carry the campaign or automation so the landing session and order are credited. */
  utmCampaign: string
}

/** UTM tags on every link we send, so the storefront session lands in the email channel. */
export function withUtm(url: string, storefrontUrl: string, campaign: string, medium: string) {
  try {
    const u = new URL(url)
    const shop = new URL(storefrontUrl)
    if (u.host !== shop.host) return url
    if (!u.searchParams.has('utm_source')) u.searchParams.set('utm_source', 'store')
    if (!u.searchParams.has('utm_medium')) u.searchParams.set('utm_medium', medium)
    if (!u.searchParams.has('utm_campaign')) u.searchParams.set('utm_campaign', campaign)
    return u.toString()
  } catch {
    return url
  }
}

/**
 * Render and send one marketing email with open and click tracking and the
 * unsubscribe link and headers, then record the outcome on its message row.
 */
export async function sendMarketingEmail(
  tx: StoreTx,
  storeId: string,
  deps: MarketingDeps,
  channel: NotificationChannel,
  sender: StoreSender,
  input: EmailSendInput,
): Promise<SendResult> {
  if (!(await mayMarket(tx, { customerId: input.customerId, channel: 'email' }))) {
    return skipForConsent(tx, input.messageId)
  }
  const secret = deps.settingsSecret
  const base = deps.storefrontUrl
  const payload = { storeId, messageId: input.messageId }
  const unsubToken = input.customerId ? unsubscribeToken(storeId, input.customerId, secret) : null
  const unsubscribe = unsubToken ? unsubscribeUrl(base, unsubToken) : undefined
  const { html, text } = renderMarketingEmail(input.blocks, {
    storeName: sender.storeName,
    storeAddress: sender.storeAddress,
    shopUrl: base,
    previewText: input.previewText,
    merge: input.merge,
    cart: input.cart,
    unsubscribeUrl: unsubscribe,
    openPixelUrl: openPixelUrl(base, messageToken(payload, secret)),
    trackLink: (url) => {
      const tagged = withUtm(url, base, input.utmCampaign, 'email')
      return clickUrl(base, clickToken(payload, tagged, secret), tagged)
    },
  })
  const headers = unsubToken
    ? [
        {
          name: 'List-Unsubscribe',
          value: `<${oneClickUnsubscribeUrl(base, unsubToken)}>`,
        },
        { name: 'List-Unsubscribe-Post', value: 'List-Unsubscribe=One-Click' },
      ]
    : undefined
  const send = channel.sendMarketing
  const result: SendResult = send
    ? await send.call(channel, {
        kind: 'email',
        to: { email: input.to },
        subject: input.subject,
        html,
        text,
        headers,
      })
    : { ok: false, error: `${channel.id} cannot send marketing email` }
  await recordOutcome(tx, input.messageId, channel.id, result)
  return result
}

export type WhatsappSendInput = {
  messageId: string
  to: string
  /** The recipient's customer; consent is checked on it unless the message is `transactional`. */
  customerId: string | null
  /** An update about the shopper's own order (COD confirmation), not marketing. */
  transactional?: boolean | undefined
  template: { name: string; language: string; variables: string[] }
  merge: MergeValues
}

/** Send an approved WhatsApp template with merge tags filled in, and record the outcome. */
export async function sendMarketingWhatsapp(
  tx: StoreTx,
  channel: NotificationChannel,
  input: WhatsappSendInput,
  apply: (s: string, m: MergeValues) => string,
): Promise<SendResult> {
  const allowed = await mayMarket(tx, {
    customerId: input.customerId,
    channel: 'whatsapp',
    transactional: input.transactional,
  })
  if (!allowed) return skipForConsent(tx, input.messageId)
  const send = channel.sendMarketing
  const result: SendResult = send
    ? await send.call(channel, {
        kind: 'whatsapp_template',
        to: { phone: input.to },
        template: {
          name: input.template.name,
          language: input.template.language,
          variables: input.template.variables.map((v) => apply(v, input.merge)),
        },
      })
    : { ok: false, error: `${channel.id} cannot send WhatsApp templates` }
  await recordOutcome(tx, input.messageId, channel.id, result)
  return result
}

async function recordOutcome(tx: StoreTx, messageId: string, channelId: string, r: SendResult) {
  await tx
    .update(marketingMessage)
    .set({
      channel: channelId,
      status: r.ok ? 'sent' : 'failed',
      providerRef: r.ok ? r.providerRef : null,
      error: r.ok ? null : r.error.slice(0, 500),
      sentAt: r.ok ? new Date() : null,
    })
    .where(eq(marketingMessage.id, messageId))
}
