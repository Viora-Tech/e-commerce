'use client'

import PageHeader from '@/components/layout/page-header'
import { shipmentsContent } from '@/data/shipments'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import NdrTab from './ndr-tab'
import PickupsTab from './pickups-tab'

type ShipmentsSubpageProps = {
  /** `pickups`: pickups and manifests; `attention`: deliveries the courier could not make. */
  kind: 'pickups' | 'attention'
}

/**
 * The queues that sit beside the Shipments table, each on its own page under Orders →
 * Shipments: pickups and manifests ("Pickups" in the header) and the deliveries that need
 * the merchant ("2 need attention" in the summary line).
 */
export default function ShipmentsSubpage({ kind }: ShipmentsSubpageProps) {
  // Hooks
  const copy = useCopy(shipmentsContent)

  // Render logic
  const head = kind === 'attention' ? copy.ndrSheet : copy.pickupsSheet

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={head.title}
        subtitle={head.body}
        back={{ label: copy.title, href: routes.orders.shipments() }}
      />
      {kind === 'attention' ? <NdrTab /> : <PickupsTab />}
    </div>
  )
}
