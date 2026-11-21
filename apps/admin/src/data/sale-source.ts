import { CHANNEL_LABELS } from './growth'

/**
 * The "Where it came from" card on the order, draft and abandoned checkout pages: the channel,
 * the site or UTM tags the shopper arrived with, and, on a staff draft, who made it.
 */
export const saleSourceContent = {
  title: 'Where it came from',
  /** The abandoned checkouts list's column. */
  column: 'Source',
  channel: 'Channel',
  cameFrom: 'Came from',
  sourceMedium: 'Source / medium',
  campaign: 'Campaign',
  landing: 'First page',
  affiliate: 'Affiliate code',
  visited: 'Visited',
  /** Nothing was saved about the visit (direct, or before tracking). */
  online: 'Online store',
  notRecorded: 'Direct, or not recorded',
  /** One row when nothing about the visit was saved: "Channel" and "Came from" said the same. */
  onlineDirect: 'Online store, direct visit or not recorded',
  /** The same names as the Orders list's Channel column and filter. */
  channels: CHANNEL_LABELS,
  admin: {
    channel: 'Admin',
    createdIn: 'Created in the admin',
    createdBy: 'Created by',
    someone: 'A staff member',
    created: 'Created',
    via: 'Made through',
    sources: {
      admin: 'Admin',
      assistant: 'AI assistant',
      mcp: 'Connected AI agent',
      api: 'Access token',
      worker: 'Background job',
      storefront: 'Storefront',
    },
  },
} as const
