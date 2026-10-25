import { describe, expect, it } from 'vitest'
import { NAV_GROUPS, SALES_CHANNELS_GROUP } from '@/data/navigation'
import { withSalesChannels } from './nav-channels'

const channelsGroup = (groups: typeof NAV_GROUPS) =>
  groups.find((g) => g.label === SALES_CHANNELS_GROUP)?.items.map((i) => i.href) ?? []

describe('withSalesChannels', () => {
  it('adds Inbox at the end of Sales channels while it is installed', () => {
    expect(channelsGroup(withSalesChannels(NAV_GROUPS, ['inbox'])).at(-1)).toBe(
      '/sales-channels/inbox',
    )
  })

  it('leaves the sidebar alone without channel apps', () => {
    expect(withSalesChannels(NAV_GROUPS, [])).toBe(NAV_GROUPS)
    expect(channelsGroup(withSalesChannels(NAV_GROUPS, ['unknown']))).toEqual(
      channelsGroup(NAV_GROUPS),
    )
  })
})
