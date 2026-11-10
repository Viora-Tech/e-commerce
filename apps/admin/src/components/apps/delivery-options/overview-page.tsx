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

export type DeliveryOptionsSection = 'overview' | 'options' | 'routes' | 'rules'

type DeliveryOptionsOverviewPageProps = { section?: DeliveryOptionsSection }

/**
 * Apps → Delivery options, one page per sidebar entry (Figma 929:11373…12840): Overview (the
 * warnings, the options and Try a PIN), Options, Routes (with Try a PIN, whose routes feed
 * the Routes card) and Product rules.
 */
export default function DeliveryOptionsOverviewPage({
  section = 'overview',
}: DeliveryOptionsOverviewPageProps) {
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
      {section === 'overview' || section === 'options' ? (
        <OptionsCard options={overview.options} onChanged={reload} />
      ) : null}
      {section === 'rules' ? (
        <RulesCard rules={overview.rules} options={overview.options} onChanged={reload} />
      ) : null}
      {section === 'routes' ? (
        <RoutesCard
          apps={overview.apps}
          health={overview.health}
          settings={overview.routeSettings}
          seen={tried?.routes ?? []}
          onChanged={reload}
        />
      ) : null}
      {section === 'overview' || section === 'routes' ? (
        <TryPinCard result={tried} onResult={setTried} />
      ) : null}
    </div>
  )
}
