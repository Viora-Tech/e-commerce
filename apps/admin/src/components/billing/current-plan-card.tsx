'use client'

import { PLAN_QUOTAS } from '@commerce/ai/client'
import type { PlanView } from '@commerce/core'
import { nextPlanUp, PLANS } from '@commerce/core/billing'
import { Progress } from '@commerce/ui/shadcn/progress'
import KitButton from '@/components/kit/kit-button'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import { billingContent } from '@/data/billing'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { bytesToGb, daysUntil, usageShare } from '@/lib/billing'

type CurrentPlanCardProps = {
  view: PlanView
  onKeepPlan: () => void
  onCompare: () => void
}

const STATUS_TONE = {
  trialing: 'info',
  active: 'success',
  due: 'attention',
  paused: 'danger',
  cancelled: 'neutral',
} as const

/** Figma "Current plan": the plan, its price and renewal, and this month's usage bars. */
export default function CurrentPlanCard({ view, onKeepPlan, onCompare }: CurrentPlanCardProps) {
  // Hooks
  const copy = useCopy(billingContent)
  const format = useFormat()

  // Render logic
  const plan = PLANS[view.plan]
  const name = copy.plans[view.plan].name
  const price = plan.pricePaise[view.interval]
  const ai = PLAN_QUOTAS[plan.ai]
  const overOrders = view.usage.orders > plan.orders
  const up = nextPlanUp(view.plan)
  const line =
    view.status === 'trialing' && view.trialEndsAt
      ? copy.current.trialEnds(format.date(view.trialEndsAt), daysUntil(view.trialEndsAt))
      : view.periodEnd
        ? view.status === 'active'
          ? copy.current.renews(format.date(view.periodEnd))
          : copy.current.ended(format.date(view.periodEnd))
        : null
  const bars = [
    { id: 'orders', label: copy.usage.orders, used: view.usage.orders, limit: plan.orders },
    { id: 'staff', label: copy.usage.staff, used: view.usage.staff, limit: plan.staff },
    { id: 'ai', label: copy.usage.ai, used: Math.ceil(view.usage.ai.credits), limit: ai.credits },
  ]

  return (
    <DataCard title={copy.current.heading} bodyClassName="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-section-title text-ink-strong">{name}</span>
            <StatusChip tone={STATUS_TONE[view.status]} variant="dot">
              {copy.status[view.status]}
            </StatusChip>
          </div>
          <span className="text-caption text-muted-foreground">
            {[format.number(plan.orders), copy.usage.orders.toLowerCase(), line]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5 text-right">
          <span className="text-section-title text-ink-strong tabular-nums">
            {view.interval === 'year'
              ? copy.perYear(format.money(price))
              : copy.perMonth(format.money(price))}
          </span>
          <span className="text-caption text-muted-foreground">
            {copy.interval[view.interval]} · {copy.gstExtra}
          </span>
        </div>
      </div>
      {view.nextPlan && view.periodEnd ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-body">
          <span>
            {copy.current.switching(copy.plans[view.nextPlan].name, format.date(view.periodEnd))}
          </span>
          <KitButton variant="linkSm" onClick={onKeepPlan}>
            {copy.current.keep}
          </KitButton>
        </div>
      ) : null}
      <div className="flex flex-col gap-4">
        {bars.map((b) => (
          <div key={b.id} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 text-body">
              <span className="text-ink-strong">{b.label}</span>
              <span
                className={`tabular-nums ${b.limit !== null && b.used > b.limit ? 'text-warning-foreground dark:text-warning' : 'text-muted-foreground'}`}
              >
                {b.limit === null
                  ? copy.usage.unlimited
                  : copy.usage.of(format.number(b.used), format.number(b.limit))}
              </span>
            </div>
            <Progress value={usageShare(b.used, b.limit)} />
          </div>
        ))}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2 text-body">
            <span className="text-ink-strong">{copy.usage.storage}</span>
            <span className="text-muted-foreground tabular-nums">
              {copy.usage.of(
                copy.usage.gb(bytesToGb(view.usage.storageBytes)),
                copy.usage.gb(String(plan.storageGb)),
              )}
            </span>
          </div>
          <Progress value={usageShare(view.usage.storageBytes, plan.storageGb * 1024 ** 3)} />
        </div>
      </div>
      {overOrders ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-body">
          <span>{up ? copy.over.upgrade(copy.plans[up].name) : copy.over.ownIt}</span>
          <KitButton variant="secondary" onClick={onCompare}>
            {copy.compare}
          </KitButton>
        </div>
      ) : null}
      <p className="text-caption text-muted-foreground">{copy.current.usageNote}</p>
    </DataCard>
  )
}
