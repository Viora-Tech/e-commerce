'use client'

import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useState } from 'react'
import SectionHead from '@/components/layout/section-head'
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
  const { overview } = useDeliveryOverview()
  const { catalogue } = useRouteCatalogue()
  const preview = useCheckoutPreview(null)
  const [tried, setTried] = useState<TryPinResult | null>(null)

  // Early returns
  if (!overview) return null

  // Render logic
  const kg = String(PREVIEW_CART.weightGrams / 1000)

  return (
    <div className="flex flex-col gap-5">
      <SectionHead title={pages.pages.overview.title} intro={pages.pages.overview.intro} />
      <DeliveryWarnings warnings={overview.warnings} />
      <OverviewTiles overview={overview} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <section className="flex flex-col gap-3 rounded-xl border border-panel-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-card-title text-ink-strong">{pages.preview.atCheckout}</h2>
              <p className="text-caption text-muted-foreground">
                {pages.preview.forPin(PREVIEW_PIN, kg)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href={routes.apps.page(APP, 'options')} />}
            >
              {pages.preview.editOptions}
            </Button>
          </div>
          <CheckoutPreviewList {...preview} />
        </section>
        <CourierAppsCard overview={overview} catalogue={catalogue} />
      </div>
      <TryPinCard result={tried} onResult={setTried} />
    </div>
  )
}
