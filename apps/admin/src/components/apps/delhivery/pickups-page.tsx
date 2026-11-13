'use client'

import PageHeader from '@/components/layout/page-header'
import PickupsTab from '@/components/shipments/pickups-tab'
import { delhiveryAppContent } from '@/data/delhivery'
import { useCopy } from '@/hooks/use-copy'

/** `/apps/delhivery/pickups`: the Pickups and manifests page with Delhivery's only. */
export default function PickupsPage() {
  // Hooks
  const { pickupsPage: copy } = useCopy(delhiveryAppContent)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={copy.title} subtitle={copy.subtitle} />
      <PickupsTab provider="delhivery" />
    </div>
  )
}
