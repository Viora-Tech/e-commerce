import {
  chooseSender,
  formatMailbox,
  getPlatformEmail,
  getSenderEmail,
  type PlatformEmail,
  parseNotificationSettings,
  type SenderEmailDeps,
  senderEmailView,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { getStore } from './store.service'

/** The platform account's pieces the sender-email services need. */
export function senderEmailDeps(platform: PlatformEmail = getPlatformEmail()): SenderEmailDeps {
  return { identities: platform.identities, reservedDomains: platform.reservedDomains }
}

/**
 * Everything the Sender email card shows: the address and its DNS records,
 * what customers see in From and Reply-To right now, and whether the store's
 * own Amazon SES app sends instead.
 */
export async function senderEmailOverview(
  tx: StoreTx,
  storeId: string,
  platform: PlatformEmail = getPlatformEmail(),
) {
  const s = await getStore(tx, storeId)
  const row = await getSenderEmail(tx)
  const chosen = chooseSender({
    storeName: s?.name ?? '',
    sender: row,
    platform: { fromEmail: platform.fromEmail, fromName: platform.fromName },
    contactEmail: s?.contactEmail,
  })
  return {
    sender: row ? senderEmailView(row, platform.identities.region) : null,
    storeName: s?.name ?? '',
    /** The store's own Amazon SES app is on: it sends, from the address saved there. */
    ownApp: parseNotificationSettings(s?.notifications).enabled.includes('ses'),
    /** The platform account sends for stores (false in development). */
    platformSending: platform.transport !== null,
    preview: {
      from: formatMailbox(chosen.fromName, chosen.fromEmail),
      replyTo: chosen.replyTo ?? null,
      using: chosen.using,
    },
  }
}
