'use client'

import { useEffect, useState } from 'react'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import PillTabs from '@/components/layout/pill-tabs'
import { shipmentsContent } from '@/data/shipments'
import { api } from '@/lib/api-client'
import NdrTab from './ndr-tab'
import NoCourierBanner from './no-courier-banner'
import PickupsTab from './pickups-tab'
import ReadyToShipTab from './ready-to-ship-tab'
import ShipmentsTab from './shipments-tab'
import WalletCards from './wallet-cards'

type TabValue = 'ready' | 'shipments' | 'pickups' | 'ndr'

const copy = shipmentsContent

/** Orders → Shipments: every courier in one place, book/track/label, pickups, NDR, wallet. */
export default function ShipmentsWorkspace() {
  // Hooks
  const [tab, setTab] = useState<TabValue>('ready')
  const [hasCourier, setHasCourier] = useState<boolean | null>(null)
  const [readyCount, setReadyCount] = useState(0)
  const [ndrCount, setNdrCount] = useState(0)

  useEffect(() => {
    api.shipments.wallets().then((w) => setHasCourier(w.length > 0))
  }, [])

  useEffect(() => {
    // Not read below; re-running when the tab changes keeps the pill counts fresh after a
    // booking or an NDR action on another tab, the same bump-key trick as ready-to-ship-tab.tsx.
    if (tab.length < 0) return
    api.shipments.readyToShip({ page: 1, perPage: 1 }).then((r) => setReadyCount(r.total))
    api.shipments.listNdr().then((r) => setNdrCount(r.length))
  }, [tab])

  return (
    <PageBody>
      <PageHeader title={copy.title} subtitle={copy.subtitle} />
      {hasCourier === false ? <NoCourierBanner /> : null}
      <WalletCards />
      <PillTabs
        variant="pill"
        tabs={[
          { value: 'ready', label: copy.tabs.readyToShip, count: readyCount },
          { value: 'shipments', label: copy.tabs.shipments },
          { value: 'pickups', label: copy.tabs.pickups },
          { value: 'ndr', label: copy.tabs.ndr, count: ndrCount },
        ]}
        value={tab}
        onChange={(v) => setTab(v ?? 'ready')}
      />
      {tab === 'ready' ? <ReadyToShipTab onSwitchToPickups={() => setTab('pickups')} /> : null}
      {tab === 'shipments' ? <ShipmentsTab /> : null}
      {tab === 'pickups' ? <PickupsTab /> : null}
      {tab === 'ndr' ? <NdrTab /> : null}
    </PageBody>
  )
}
