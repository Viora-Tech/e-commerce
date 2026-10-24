import { type InboxHub, type PubSubPublisher, processInboxHub } from '@commerce/core/inbox/server'
import { createConnection, sharedRedis } from './index'

/**
 * SOURCE OF TRUTH KEYWORDS: inboxHub, inboxPublisher
 * WHAT:  The process's Inbox realtime hub on its own Redis connection (a connection in
 *        subscribe mode can do nothing else, so it is never `sharedRedis`), and the publisher
 *        (the shared connection).
 * WHY:   Admin and storefront stream routes hold one subscriber per Node process and fan out
 *        in memory (design 2026-10-24-inbox §4).
 * WHERE: apps/admin `api/inbox/stream`, apps/storefront `-s/[storeId]/inbox/[action]`, the
 *        admin and storefront `inboxPublisher` hosts.
 */
export const inboxHub = (redisUrl: string): InboxHub =>
  processInboxHub(() => createConnection(redisUrl))

export const inboxPublisher = (redisUrl: string): PubSubPublisher => sharedRedis(redisUrl)
