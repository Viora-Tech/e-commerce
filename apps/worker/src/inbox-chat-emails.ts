import { sendInboxChatEmails } from '@commerce/core/inbox/server'
import { registriesForStore } from '@commerce/core/registries'
import { type Db, storesWithInboxChatEmails, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'

/** The rules wait five minutes before an email; checking every two keeps it close to that. */
export const INBOX_CHAT_EMAILS_EVERY_MS = 2 * 60_000

/**
 * One repeat job walks every store with an Inbox chat touched in the last day and sends what
 * is due (`sendInboxChatEmails`): a shopper's missed reply or closed chat, and the team's list
 * of chats waiting for an answer. Each chat is claimed before it is sent, so overlapping ticks
 * never send twice. One store failing is logged and skipped.
 */
export function createInboxChatEmails(
  db: Db,
  opts: { settingsSecret: string; adminUrl: string; storefrontUrl: string },
) {
  const run = async () => {
    const storeIds = await storesWithInboxChatEmails(db)
    const sent = { replies: 0, transcripts: 0, staff: 0 }
    for (const storeId of storeIds) {
      try {
        const n = await withStore(db, storeId, async (tx) =>
          sendInboxChatEmails(
            { storeId, tx },
            {
              registry: (await registriesForStore(tx, storeId)).notifications,
              settingsSecret: opts.settingsSecret,
              adminUrl: opts.adminUrl,
              storefrontUrl: opts.storefrontUrl,
            },
          ),
        )
        sent.replies += n.replies
        sent.transcripts += n.transcripts
        sent.staff += n.staff
      } catch (err) {
        logger.warn('inbox chat emails failed', { storeId, error: err })
      }
    }
    if (sent.replies + sent.transcripts + sent.staff) logger.info('inbox chat emails sent', sent)
    return { stores: storeIds.length, ...sent }
  }
  return { run }
}
