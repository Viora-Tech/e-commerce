/** The Delhivery app bar: the tracking pill (says the key worked only after a recent change) and the in-transit count on Shipments. */
import type { AppBarContext } from '@commerce/plugins'
import { describe, expect, it } from 'vitest'
import { delhiveryAppBar } from '../src/app-bar'

const NOW = new Date('2026-11-13T09:30:00Z')

const ctx = (lastUpdate: Date | null, canRead = true): AppBarContext =>
  ({
    can: () => canRead,
    courierActivity: async () => ({ moving: 23, lastUpdate }),
  }) as unknown as AppBarContext

describe('delhiveryAppBar', () => {
  it('says the API key works after a recent update, and counts parcels on Shipments', async () => {
    const at = new Date(NOW.getTime() - 3 * 60_000)
    expect(await delhiveryAppBar(ctx(at), NOW)).toEqual({
      statusPill: { label: 'API key working · last tracking update', tone: 'success', at },
      pageCounts: { shipments: 23 },
    })
  })

  it('only gives the time when the last change is days old', async () => {
    const at = new Date(NOW.getTime() - 5 * 24 * 3_600_000)
    const bar = await delhiveryAppBar(ctx(at), NOW)
    expect(bar?.statusPill?.label).toBe('Last tracking update')
  })

  it('shows nothing to a member who cannot read orders', async () => {
    expect(await delhiveryAppBar(ctx(NOW, false), NOW)).toBeNull()
  })
})
