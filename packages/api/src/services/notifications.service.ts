import {
  isMessageOn,
  MESSAGE_CATALOGUE,
  messageDef,
  messageSwitchable,
  parseAppsSettings,
  parseNotificationSettings,
  resolveNotificationChannels,
  withMessage,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  type NotificationRegistry,
  renderEmail,
  renderWhatsapp,
  sampleTemplateDataByTemplate,
  type TemplateData,
  type TemplateId,
} from '@commerce/notifications'
import { getStore, updateStoreNotifications } from './store.service'

/** The apps that carry messages, by the kind of channel they give a store. */
const CHANNEL_APPS = { email: 'ses', whatsapp: 'whatsapp' } as const

export type ChannelKind = keyof typeof CHANNEL_APPS

/**
 * `connected`: the app is installed and its account saved and switched on.
 * `installed`: installed but not connected yet. `missing`: not installed.
 */
export type ChannelState = 'connected' | 'installed' | 'missing'

export type ChannelStatus = {
  kind: ChannelKind
  appId: string
  state: ChannelState
  /** WhatsApp's "send plain text" switch: only reaches people who messaged the shop in the last day. */
  testMode: boolean
}

function channelStatus(
  kind: ChannelKind,
  installed: Set<string>,
  enabled: Set<string>,
  providers: Record<string, Record<string, string>>,
): ChannelStatus {
  const appId = CHANNEL_APPS[kind]
  const state: ChannelState = !installed.has(appId)
    ? 'missing'
    : enabled.has(appId)
      ? 'connected'
      : 'installed'
  return { kind, appId, state, testMode: providers[appId]?.testMode === 'true' }
}

/**
 * Everything Settings → Notifications shows: each message with whether it is
 * on, and how messages go out (email and WhatsApp apps, the dev log).
 */
export async function notificationsOverview(tx: StoreTx, storeId: string) {
  const s = await getStore(tx, storeId)
  const settings = parseNotificationSettings(s?.notifications)
  const installed = new Set(parseAppsSettings(s?.apps).installed)
  const enabled = new Set(settings.enabled)
  const email = channelStatus('email', installed, enabled, settings.providers)
  const whatsapp = channelStatus('whatsapp', installed, enabled, settings.providers)
  return {
    messages: MESSAGE_CATALOGUE.map((m) => ({
      id: m.id,
      group: m.group,
      trigger: m.trigger,
      channels: [...m.channels],
      appId: m.appId ?? null,
      switchable: messageSwitchable(m.id),
      on: isMessageOn(settings, m.id),
    })),
    channels: { email, whatsapp },
    /** The development log channel prints every message to the console instead of sending it. */
    devLog: enabled.has('log'),
    /** A test email can go out: an email app is connected, or the dev log is on. */
    canSendTest: email.state === 'connected' || enabled.has('log'),
    /** Where "Send me a test" goes: the merchant's own contact email is shown for reference. */
    storeEmail: s?.contactEmail ?? null,
  }
}

/** Switch one message on or off. Messages that cannot be switched off are left alone. */
export async function setMessageOn(tx: StoreTx, storeId: string, id: string, on: boolean) {
  const s = await getStore(tx, storeId)
  const settings = parseNotificationSettings(s?.notifications)
  // The stored blob already holds encrypted credentials; only `off` changes.
  const raw = (s?.notifications ?? {}) as Record<string, unknown>
  await updateStoreNotifications(tx, storeId, { ...raw, off: withMessage(settings, id, on) })
  return { id, on: isMessageOn({ off: withMessage(settings, id, on) }, id) }
}

/** Sample data with this store's name, so the preview reads like the shop's own message. */
function sampleFor(template: TemplateId, storeName: string | undefined): TemplateData {
  const base = sampleTemplateDataByTemplate[template]
  return storeName ? { ...base, storeName } : base
}

/** The email (and WhatsApp text) a customer would get, filled with a sample order. */
export async function previewMessage(tx: StoreTx, storeId: string, template: TemplateId) {
  const s = await getStore(tx, storeId)
  const data = sampleFor(template, s?.name)
  const email = await renderEmail(template, data)
  const def = messageDef(template)
  return {
    subject: email.subject,
    html: email.html,
    text: email.text,
    whatsapp: def?.channels.includes('whatsapp') ? renderWhatsapp(template, data).text : null,
  }
}

/**
 * Send one message, filled with the sample order, to the signed-in person's
 * own email through the store's email channels (never WhatsApp, never a
 * customer). Returns what happened in plain words.
 */
export async function sendTestMessage(
  tx: StoreTx,
  storeId: string,
  input: {
    template: TemplateId
    to: string
    registry: NotificationRegistry
    secret: string
    previousSecrets: string[]
  },
): Promise<{ ok: boolean; sent: number; error?: string | undefined }> {
  const s = await getStore(tx, storeId)
  const { channels } = resolveNotificationChannels(
    input.registry,
    parseNotificationSettings(s?.notifications),
    input.secret,
    input.previousSecrets,
  )
  const email = channels.filter((c) => c.requires === 'email')
  if (email.length === 0) return { ok: false, sent: 0, error: 'no_channel' }
  const data = sampleFor(input.template, s?.name)
  let sent = 0
  let error: string | undefined
  for (const channel of email) {
    const r = await channel.send({ to: { email: input.to }, template: input.template, data })
    if (r.ok) sent += 1
    else error = r.error
  }
  return { ok: sent > 0, sent, error: sent > 0 ? undefined : error }
}
