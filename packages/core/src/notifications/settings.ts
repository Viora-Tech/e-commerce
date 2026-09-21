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
})
export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>

export const defaultNotificationSettings: NotificationSettings = { enabled: [], providers: {} }

export function parseNotificationSettings(raw: unknown): NotificationSettings {
  const r = NotificationSettingsSchema.safeParse(raw)
  return r.success ? r.data : defaultNotificationSettings
}

export const encryptNotificationSettings = (
  s: NotificationSettings,
  secret: string,
): NotificationSettings => encryptProviderSettings(s, secret)

export const decryptNotificationSettings = (
  s: NotificationSettings,
  secret: string,
): NotificationSettings => decryptProviderSettings(s, secret)

export const maskNotificationSettings = (s: NotificationSettings): NotificationSettings =>
  maskProviderSettings(s)

/** Channels every deployment has without an adapter package: the worker log, for development. */
export function builtInNotificationRegistry(): NotificationRegistry {
  return new NotificationRegistry().register(logChannelFactory)
}

/** Build the channels a store has enabled from the registry with that store's decrypted credentials. */
export function resolveNotificationChannels(
  registry: NotificationRegistry,
  settings: NotificationSettings,
  secret: string,
): { channels: NotificationChannel[]; errors: string[] } {
  const decrypted = decryptNotificationSettings(settings, secret)
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
