import { sql } from 'drizzle-orm'
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { newId, store } from './schema'

/*
 * Sales channels → Social media and Agentic sales, the live connections: which platform account
 * a store connected, its tokens (encrypted with SETTINGS_SECRET), and which catalog items were
 * sent. Where each channel stands (first sync, connected, error…) stays on
 * `store.preferences.salesChannels`; this is what the sync needs to reach the platform.
 */

/**
 * `meta`: one Facebook business catalog that Facebook, Instagram and WhatsApp all read.
 * `google`: a Google Merchant Center account. `openai`: the ChatGPT merchant feed endpoint.
 */
const CHANNEL_PROVIDERS = ['meta', 'google', 'openai'] as const
export type ChannelProvider = (typeof CHANNEL_PROVIDERS)[number]

const at = (name: string) => timestamp(name, { withTimezone: true })

export const channelConnection = pgTable(
  'channel_connection',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    storeId: uuid('store_id')
      .notNull()
      .references(() => store.id),
    provider: text('provider').$type<ChannelProvider>().notNull(),
    /** Encrypted (`encryptSecret`). Meta: a long-lived user token. Google: the access token. OpenAI: the feed API key. */
    accessToken: text('access_token').notNull(),
    /** Encrypted. Google only. */
    refreshToken: text('refresh_token'),
    /** When the access token lapses (Meta: about 60 days; Google: an hour, then refreshed). */
    expiresAt: at('expires_at'),
    /** Meta business id, Google Merchant Center account id. */
    accountId: text('account_id'),
    /** What the merchant sees: the business, the Merchant Center account. */
    accountName: text('account_name'),
    /** Meta catalog id, Google data source name, OpenAI feed endpoint. */
    target: text('target'),
    /** Anything else a provider keeps (Meta's WhatsApp Business account id). */
    extra: jsonb('extra').$type<Record<string, string>>().notNull().default({}),
    createdAt: at('created_at').notNull().defaultNow(),
    updatedAt: at('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('channel_connection_provider').on(t.storeId, t.provider),
    check('channel_connection_provider_check', sql`${t.provider} in ('meta','google','openai')`),
  ],
)

/** One catalog item a provider holds, and a hash of what was sent, so a sync sends only changes. */
export const channelListing = pgTable(
  'channel_listing',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    storeId: uuid('store_id')
      .notNull()
      .references(() => store.id),
    provider: text('provider').$type<ChannelProvider>().notNull(),
    /** Our id for the item on the platform (the variant id). */
    itemId: text('item_id').notNull(),
    hash: text('hash').notNull(),
    syncedAt: at('synced_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('channel_listing_item').on(t.storeId, t.provider, t.itemId),
    index('channel_listing_store').on(t.storeId, t.provider),
  ],
)
