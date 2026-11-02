/** SOURCE OF TRUTH: a store's look in its emails — WHAT: logo, brand colour, socials, support contact and shop link for every notification email / WHY: one loader so all 53 emails carry the same branding without each caller building it */
import { type StoreTx, store } from '@commerce/db'
import type { EmailBrandInfo, NotificationChannel } from '@commerce/notifications'
import { eq } from 'drizzle-orm'
import { primaryStoreHostname } from '../domains/origin'
import { storeSender } from '../marketing/send'
import { liveThemeSettings } from '../theme/library'

const absoluteUrl = (url: string | null | undefined) =>
  url && /^https:\/\//i.test(url) ? url : null

/**
 * The store's email look from its live theme (logo, the light scheme's button colour, social
 * profiles) and its store details (contact email and phone, address, primary domain).
 * Never throws: a store with a broken theme still sends, in the neutral look.
 */
export async function storeEmailBrand(tx: StoreTx, storeId: string): Promise<EmailBrandInfo> {
  try {
    const [theme, sender, host, [s]] = await Promise.all([
      liveThemeSettings(tx, storeId),
      storeSender(tx, storeId),
      primaryStoreHostname(tx, storeId),
      tx
        .select({ email: store.contactEmail, phone: store.contactPhone })
        .from(store)
        .where(eq(store.id, storeId)),
    ])
    const scheme = theme.schemes.find((c) => c.id === theme.lightScheme) ?? theme.schemes[0]
    return {
      logoUrl: absoluteUrl(theme.brand.logo?.url),
      logoWidth: theme.brand.logoWidth,
      colour: scheme?.button,
      onColour: scheme?.buttonText,
      shopUrl: host ? `https://${host}` : null,
      supportEmail: s?.email ?? null,
      supportPhone: s?.phone ?? null,
      address: sender.storeAddress ?? null,
      social: theme.social.links.map((l) => ({ platform: l.platform, url: l.url })),
    }
  } catch {
    return {}
  }
}

/**
 * The same channels, with the store's look attached to every email they send. A caller that
 * already set `brand` (a preview with a draft theme) keeps its own. WhatsApp sends are untouched.
 */
export function withEmailBrand(
  channels: NotificationChannel[],
  brand: () => Promise<EmailBrandInfo>,
): NotificationChannel[] {
  let loaded: Promise<EmailBrandInfo> | undefined
  const once = () => {
    loaded ??= brand()
    return loaded
  }
  const send =
    (channel: NotificationChannel): NotificationChannel['send'] =>
    async (message) =>
      channel.send({
        ...message,
        data: message.data.brand ? message.data : { ...message.data, brand: await once() },
      })
  // A proxy, not a copy: channels are class instances whose other methods need their own `this`.
  return channels.map((channel) =>
    channel.requires !== 'email'
      ? channel
      : new Proxy(channel, {
          get(target, key, receiver) {
            if (key === 'send') return send(target)
            const value = Reflect.get(target, key, receiver)
            return typeof value === 'function' ? value.bind(target) : value
          },
        }),
  )
}
