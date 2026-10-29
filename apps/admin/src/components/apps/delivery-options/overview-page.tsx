'use client'

import { TriangleAlert } from '@commerce/ui/icons'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { Overview, TryPinResult } from './format'
import OptionsCard from './options-card'
import RoutesCard from './routes-card'
import RulesCard from './rules-card'
import TryPinCard from './try-pin-card'

/**
 * Apps → Delivery options (full page, cards, dialogs; no drawers): the connected courier apps
 * and route settings, the options shoppers pick from, the product route rules, and Try a PIN
 * with every route's quote. Try a PIN's routes feed the Routes card, so a route can be set
 * up straight from what the apps answered.
 */
export default function DeliveryOptionsOverviewPage() {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [tried, setTried] = useState<TryPinResult | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (version < 0) return
    api.deliveryOptions
      .overview()
      .then(setOverview)
      .catch((err) => toast.error(err instanceof Error ? err.message : copy.failed))
  }, [version, copy.failed])

  // Helpers
  const reload = () => setVersion((v) => v + 1)

  // Early returns
  if (!overview) return null

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={copy.title} summary={copy.subtitle} />
      {overview.warnings.map((w) => (
        <p
          key={w}
          role="status"
          className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-soft px-3 py-2.5 text-body text-ink-strong"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
          {copy.warnings[w]}
        </p>
      ))}
      <OptionsCard options={overview.options} onChanged={reload} />
      <RulesCard rules={overview.rules} options={overview.options} onChanged={reload} />
      <RoutesCard
        apps={overview.apps}
        settings={overview.routeSettings}
        seen={tried?.routes ?? []}
        onChanged={reload}
      />
      <TryPinCard result={tried} onResult={setTried} />
    </div>
  )
}
