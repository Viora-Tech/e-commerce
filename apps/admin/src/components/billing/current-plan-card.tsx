'use client'

import { PLAN_QUOTAS } from '@commerce/ai/client'
import type { PlanView } from '@commerce/core'
import { PLANS } from '@commerce/core/billing'
import { Card } from '@commerce/ui/shadcn/card'
import { Progress } from '@commerce/ui/shadcn/progress'
import KitButton from '@/components/kit/kit-button'
import StatusChip from '@/components/layout/status-chip'
import { billingContent } from '@/data/billing'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { bytesToGb, daysUntil, feePercent, usageShare } from '@/lib/billing'
import { routes } from '@/lib/routes'

type CurrentPlanCardProps = {
  view: PlanView
  onKeepPlan: () => void
}

const STATUS_TONE = {
  trialing: 'info',
  active: 'success',
  due: 'attention',
  paused: 'danger',
  cancelled: 'neutral',
} as const

/**
 * Figma 931:9997 plan card: the plan with its status chip, what it includes, the price, this
 * month's usage bars and, when a bigger plan costs less at this pace, the "See Pro" nudge.
 */
export default function CurrentPlanCard({ view, onKeepPlan }: CurrentPlanCardProps) {
  // Hooks
  const copy = useCopy(billingContent)
  const format = useFormat()

  // Render logic
  const plan = PLANS[view.plan]
  const price = plan.pricePaise[view.interval]
  const percent = feePercent(plan.feeBasisPoints)
  const orders = format.number(plan.orders)
  const when =
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
    {
      id: 'ai',
      label: copy.usage.ai,
      used: Math.ceil(view.usage.ai.credits),
      limit: PLAN_QUOTAS[plan.ai].credits,
    },
  ]
  const nudge = view.nudge
  const nudgeText = nudge
    ? (view.usage.orders >= plan.orders ? copy.nudge.past : copy.nudge.close)(
        orders,
        percent,
        copy.plans[nudge.plan].name,
        format.moneyWhole(nudge.savingInr * 100),
      )
    : null

  return (
    <Card gap={5} inset={5}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="text-section-title text-ink-strong">{copy.plans[view.plan].name}</h2>
            <StatusChip tone={STATUS_TONE[view.status]}>{copy.status[view.status]}</StatusChip>
          </div>
          <p className="text-caption text-muted-foreground">
            {[copy.interval[view.interval], when].filter(Boolean).join(' · ')}
          </p>
          <p className="text-caption text-muted-foreground">
            {plan.feeBasisPoints > 0
              ? copy.current.included(orders, percent)
              : copy.current.includedNoFee(orders)}
          </p>
        </div>
        <div className="flex flex-col items-end text-right">
          <span className="text-section-title text-ink-strong tabular-nums">
            {format.money(price)}
          </span>
          <span className="text-caption text-muted-foreground">
            {view.interval === 'year' ? copy.current.perYearGst : copy.current.perMonthGst}
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
                className={`tabular-nums ${b.used > b.limit ? 'text-warning-foreground dark:text-warning' : 'text-muted-foreground'}`}
              >
                {copy.usage.of(format.number(b.used), format.number(b.limit))}
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
      {nudge && nudgeText ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted px-3 py-3 text-caption text-foreground">
          <p className="max-w-md">{nudgeText}</p>
          <KitButton variant="secondary" href={routes.settings.billingPlans()}>
            {copy.nudge.see(copy.plans[nudge.plan].name)}
          </KitButton>
        </div>
      ) : null}
    </Card>
  )
}
