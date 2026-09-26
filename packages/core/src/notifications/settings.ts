import { type NotificationChannel, NotificationRegistry } from '@commerce/notifications'
import { z } from 'zod'
import { logChannelFactory } from '../providers/log-channel'
import {
  decryptProviderSettings,
  encryptProviderSettings,
  maskProviderSettings,
} from '../settings/secrets'

/** Stored on store.notifications. Secret fields are encrypted before they reach the row. */
export const NotificationSettingsSchema = z.object({
  /** Channels that receive every order event. */
  enabled: z.array(z.string().min(1)).default([]),
  providers: z.record(z.string(), z.record(z.string(), z.string())).default({}),
  /** Nudge shoppers who left a basket behind. Off until a merchant turns it on. */
  recoverAbandoned: z.boolean().default(false),
  /** Messages the merchant switched off in Settings → Notifications (template ids). Empty: all on. */
  off: z.array(z.string().min(1).max(64)).max(64).default([]),
})
export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>

export const defaultNotificationSettings: NotificationSettings = {
  enabled: [],
  providers: {},
  recoverAbandoned: false,
  off: [],
}

export function parseNotificationSettings(raw: unknown): NotificationSettings {
  const r = NotificationSettingsSchema.safeParse(raw)
  return r.success ? r.data : defaultNotificationSettings
}

const fieldsOf = (registry: NotificationRegistry) => (id: string) => registry.get(id)?.fields

export const encryptNotificationSettings = (
  s: NotificationSettings,
  secret: string,
  registry?: NotificationRegistry,
): NotificationSettings =>
  encryptProviderSettings(s, secret, registry ? fieldsOf(registry) : undefined)

export const decryptNotificationSettings = (
  s: NotificationSettings,
  secret: string,
  previousSecrets: string[] = [],
): NotificationSettings => decryptProviderSettings(s, secret, previousSecrets)

export const maskNotificationSettings = (
  s: NotificationSettings,
  registry?: NotificationRegistry,
): NotificationSettings => maskProviderSettings(s, registry ? fieldsOf(registry) : undefined)

/** Channels every deployment has without an adapter package: the worker log, for development. */
export function builtInNotificationRegistry(): NotificationRegistry {
  return new NotificationRegistry().register(logChannelFactory)
}

/** Build the channels a store has enabled from the registry with that store's decrypted credentials. */
export function resolveNotificationChannels(
  registry: NotificationRegistry,
  settings: NotificationSettings,
  secret: string,
  previousSecrets: string[] = [],
): { channels: NotificationChannel[]; errors: string[] } {
  const decrypted = decryptNotificationSettings(settings, secret, previousSecrets)
  const channels: NotificationChannel[] = []
  const errors: string[] = []
  for (const id of decrypted.enabled) {
    const r = registry.create(id, decrypted.providers[id] ?? {})
    if (r.ok) channels.push(r.channel)
    else errors.push(`${id}: ${r.errors.join(', ')}`)
  }
  return { channels, errors }
}

export { NotificationRegistry }
