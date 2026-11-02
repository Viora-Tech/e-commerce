/** SOURCE OF TRUTH: a store's sending channels — WHAT: its enabled apps plus the platform email sender / WHY: every send path picks From and Reply-To the same way */
import { type StoreTx, senderEmail, store } from '@commerce/db'
import type { NotificationChannel, NotificationRegistry } from '@commerce/notifications'
import { eq } from 'drizzle-orm'
import { storeEmailBrand, withEmailBrand } from '../notifications/email-brand'
import { parseNotificationSettings, resolveNotificationChannels } from '../notifications/settings'
import { LogNotificationChannel } from '../providers/log-channel'
import { type ChosenSender, chooseSender } from './client'
import { getPlatformEmail, type PlatformEmail } from './platform'

export type StoreChannelDeps = {
  registry: NotificationRegistry
  settingsSecret: string
  previousSecrets?: string[] | undefined
  /** The platform account; defaults to the one built from env. Tests pass their own. */
  platform?: PlatformEmail | undefined
}

/** Tests pass their own channels; only a real development run gets the log fallback. */
const devFallback = () => !['production', 'test'].includes(process.env.NODE_ENV ?? '')

/** A store's own email app (Amazon SES) wins; the dev log channel does not count. */
const ownsEmail = (channels: NotificationChannel[]) =>
  channels.some((c) => c.requires === 'email' && c.id !== 'log')

/** Who the platform sender would send as for this store right now. */
async function platformSenderFor(
  tx: StoreTx,
  storeId: string,
  platform: { fromEmail: string; fromName: string },
): Promise<ChosenSender> {
  const [s] = await tx
    .select({ name: store.name, contactEmail: store.contactEmail })
    .from(store)
    .where(eq(store.id, storeId))
  const [row] = await tx.select().from(senderEmail)
  return chooseSender({
    storeName: s?.name ?? '',
    sender: row ?? null,
    platform,
    contactEmail: s?.contactEmail,
  })
}

/**
 * Every channel a store sends through: the apps it enabled (decrypted from its
 * settings), plus the platform email sender when the store has no email app of
 * its own. The platform sender uses the store's verified address as From, or
 * the platform's address with Reply-To set to the store until it is verified.
 */
export async function storeNotificationChannels(
  tx: StoreTx,
  storeId: string,
  deps: StoreChannelDeps,
): Promise<NotificationChannel[]> {
  const [s] = await tx
    .select({ notifications: store.notifications })
    .from(store)
    .where(eq(store.id, storeId))
  const { channels } = resolveNotificationChannels(
    deps.registry,
    parseNotificationSettings(s?.notifications),
    deps.settingsSecret,
    deps.previousSecrets,
  )
  // Every email this store sends carries its own logo, colour and contact (loaded on first send).
  const branded = (list: NotificationChannel[]) =>
    withEmailBrand(list, () => storeEmailBrand(tx, storeId))
  const transport = (deps.platform ?? getPlatformEmail()).transport
  // Development without the platform account: print emails to the worker log rather than
  // refusing every send ("enable an email channel"), so hand-sent messages can be tried locally.
  if (!transport && !channels.some((c) => c.requires === 'email') && devFallback()) {
    return branded([...channels, new LogNotificationChannel()])
  }
  if (!transport || ownsEmail(channels)) return branded(channels)
  return branded([...channels, transport.channel(await platformSenderFor(tx, storeId, transport))])
}
