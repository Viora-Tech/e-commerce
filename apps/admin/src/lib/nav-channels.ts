import { CHANNEL_NAV, type NavGroup, SALES_CHANNELS_GROUP } from '@/data/navigation'

/**
 * The sidebar groups with each installed sales channel app (Inbox) added at the end of Sales
 * channels, in the order given. Apps without a sidebar entry, and unknown ids, are skipped.
 */
export function withSalesChannels(groups: NavGroup[], channels: readonly string[]): NavGroup[] {
  const extra = channels.flatMap((id) => {
    const item = CHANNEL_NAV[id]
    return item ? [item] : []
  })
  if (extra.length === 0) return groups
  return groups.map((g) =>
    g.label === SALES_CHANNELS_GROUP ? { ...g, items: [...g.items, ...extra] } : g,
  )
}
