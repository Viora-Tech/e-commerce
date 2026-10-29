'use client'

import { PLAN_QUOTAS } from '@commerce/ai/client'
import type { PlanView } from '@commerce/core'
import DataCard from '@/components/layout/data-card'
import KeyValueList from '@/components/layout/key-value-list'
import StatusChip from '@/components/layout/status-chip'
import { billingContent } from '@/data/billing'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { bytesToGb } from '@/lib/billing'

type UnlimitedPlanCardProps = { view: PlanView }

/** A Koomerce store's plan: what it used this month, with no limits beside it. */
export default function UnlimitedPlanCard({ view }: UnlimitedPlanCardProps) {
  // Hooks
  const copy = useCopy(billingContent)
  const format = useFormat()

  // Render logic
  const rows = [
    { label: copy.usage.orders, value: format.number(view.usage.orders) },
    { label: copy.usage.staff, value: format.number(view.usage.staff) },
    {
      label: copy.usage.ai,
      value: copy.unlimited.aiCap(
        format.number(Math.ceil(view.usage.ai.credits)),
        format.number(PLAN_QUOTAS.internal.credits),
      ),
    },
    { label: copy.usage.storage, value: copy.usage.gb(bytesToGb(view.usage.storageBytes)) },
  ]

  return (
    <DataCard title={copy.current.heading} bodyClassName="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-section-title text-ink-strong">{copy.unlimited.name}</span>
          <StatusChip tone="success" variant="dot">
            {copy.status.active}
          </StatusChip>
        </div>
        <span className="text-caption text-muted-foreground">{copy.unlimited.line}</span>
      </div>
      <KeyValueList variant="grid" rows={rows} />
    </DataCard>
  )
}
