'use client'

import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useState } from 'react'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import DataCard from '@/components/layout/data-card'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import SectionHead from '@/components/layout/section-head'
import StatStrip from '@/components/layout/stat-strip'
import { appsContent } from '@/data/apps'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import CheckoutPreviewList from './checkout-preview-list'
import CourierAppsCard from './courier-apps-card'
import DeliveryWarnings from './delivery-warnings'
import type { TryPinResult } from './format'
import OverviewTiles from './overview-tiles'
import TryPinCard from './try-pin-card'
import { PREVIEW_CART, PREVIEW_PIN, useCheckoutPreview } from './use-checkout-preview'
import { useDeliveryOverview, useRouteCatalogue } from './use-delivery-overview'

const APP = 'delivery-options'

/**
 * Apps → Delivery options → Overview (Figma 929:11373): the four health tiles, what checkout
 * shows a Bengaluru shopper now, how each courier app answers, and Try a PIN.
 */
export default function DeliveryOptionsOverviewPage() {
  // Hooks
  const pages = useCopy(deliveryPagesContent)
  const apps = useCopy(appsContent)
  const { overview, failed, reload } = useDeliveryOverview()
  const { catalogue } = useRouteCatalogue()
  const preview = useCheckoutPreview(null)
  const [tried, setTried] = useState<TryPinResult | null>(null)

  // Early returns
  if (!overview) {
    return (
      <div className="flex flex-col gap-5">
        <SectionHead title={pages.pages.overview.title} intro={pages.pages.overview.intro} />
        {failed ? (
          <LoadFailedState size="page" heading={apps.couldNotLoad.overview} onRetry={reload} />
        ) : (
          // The four tiles, the checkout preview beside the courier apps, and Try a PIN.
          <>
            <StatStrip tiles={[]} loading placeholders={4} />
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
              <DataCardSkeleton fields={0} lines={4} />
              <DataCardSkeleton fields={0} lines={3} />
            </div>
            <DataCardSkeleton fields={1} />
          </>
        )}
      </div>
    )
  }

  // Render logic
  const kg = String(PREVIEW_CART.weightGrams / 1000)

  return (
    <div className="flex flex-col gap-5">
      <SectionHead title={pages.pages.overview.title} intro={pages.pages.overview.intro} />
      <DeliveryWarnings warnings={overview.warnings} />
      <OverviewTiles overview={overview} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <DataCard
          title={pages.preview.atCheckout}
          subtitle={pages.preview.forPin(PREVIEW_PIN, kg)}
          action={
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href={routes.apps.page(APP, 'options')} />}
            >
              {pages.preview.editOptions}
            </Button>
          }
        >
          <CheckoutPreviewList {...preview} />
        </DataCard>
        <CourierAppsCard overview={overview} catalogue={catalogue} />
      </div>
      <TryPinCard result={tried} onResult={setTried} />
    </div>
  )
}
