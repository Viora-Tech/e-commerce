'use client'

import {
  APP_PRICING,
  type BillingInterval,
  breakEvenOrders,
  feesAtPace,
  type MonthPace,
  PLAN_IDS,
  PLANS,
  type PlanId,
  planRank,
} from '@commerce/core/billing'
import { CheckIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import PillTabs from '@/components/layout/pill-tabs'
import { billingContent } from '@/data/billing'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { feePercent, ownItContactUrl } from '@/lib/billing'
import PlanCompareTable from './plan-compare-table'

type PlanChooserProps = {
  current: PlanId
  currentInterval: BillingInterval
  /** False while trialing: every plan, the current one too, is a choice. */
  paid: boolean
  busy: PlanId | null
  onChoose: (plan: PlanId, interval: BillingInterval) => void
  /** The plan the store's orders point to (Figma 931:10521): marked Suggested. */
  suggested?: PlanId | null | undefined
  /** This month's orders, for "Based on N orders" and each card's "at your pace" line. */
  pace?: MonthPace | null | undefined
}

/** Paid apps a plan includes from, by name: Growth's "Reviews, Back in stock, Forms, Affiliates". */
const appsFrom = (plan: PlanId): string =>
  Object.values(APP_PRICING)
    .filter((a) => a.includedFrom === plan)
    .map((a) => a.name)
    .join(', ')

const APP_PRICES = Object.values(APP_PRICING).map((a) => a.pricePaise)

/** Break-even orders read as "~400": rounded to the nearest 10. */
const roughly = (n: number): number => Math.max(10, Math.round(n / 10) * 10)

/**
 * Figma "Change plan" (931:10521): Starter to Scale as cards with short highlights, each with its
 * included orders and what it would cost at this month's pace, then "Compare everything" and Own
 * it. Also the trial's Compare plans popup.
 */
export default function PlanChooser({
  current,
  currentInterval,
  paid,
  busy,
  onChoose,
  suggested = null,
  pace = null,
}: PlanChooserProps) {
  // Hooks
  const copy = useCopy(billingContent)
  const format = useFormat()
  const [interval, setInterval] = useState<BillingInterval>(currentInterval)

  // Helpers
  const paceLine = (p: PlanId): string | null => {
    const t = copy.changePlan
    if (PLANS[p].feeBasisPoints === 0) return t.noFeeAtAll
    if (!pace || pace.avgOrderPaise === null) return null
    const past = planRank(p) > planRank(current) ? breakEvenOrders(p, pace.avgOrderPaise) : null
    if (past !== null) return t.bestPast(format.number(roughly(past)))
    return t.feesAtPace(format.moneyWhole(feesAtPace(p, pace) * 100))
  }

  // Render logic
  const c = copy.changePlan
  const d = copy.dialog
  const highlight: Record<PlanId, string> = {
    starter: c.highlights.starter(
      format.moneyWhole(Math.min(...APP_PRICES)),
      format.moneyWhole(Math.max(...APP_PRICES)),
    ),
    growth: c.highlights.growth(appsFrom('growth')),
    pro: c.highlights.pro,
    scale: c.highlights.scale,
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PillTabs
          variant="segmented"
          value={interval}
          onChange={setInterval}
          tabs={[
            { value: 'month', label: copy.interval.month },
            { value: 'year', label: `${copy.interval.year} · ${copy.yearlySaving}` },
          ]}
        />
        {pace && pace.orders > 0 ? (
          <span className="text-caption text-muted-foreground">
            {c.basedOn(format.number(pace.orders))}
          </span>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {PLAN_IDS.map((p) => {
          const plan = PLANS[p]
          const isCurrent = paid && p === current && interval === currentInterval
          const line = paceLine(p)
          return (
            <section
              key={p}
              className={cn(
                'flex flex-col gap-3 rounded-lg border p-4',
                p === suggested && !isCurrent ? 'border-2 border-primary' : 'border-border',
              )}
            >
              <div className="flex flex-col gap-1">
                <h3 className="flex items-center gap-2 text-card-title text-ink-strong">
                  {copy.plans[p].name}
                  {isCurrent ? <Badge variant="success">{c.current}</Badge> : null}
                  {p === suggested && !isCurrent ? (
                    <Badge variant="info">{d.suggested}</Badge>
                  ) : null}
                </h3>
                <p className="text-caption text-muted-foreground">{copy.plans[p].blurb}</p>
              </div>
              <p className="flex items-baseline gap-1">
                <span className="text-page-title text-ink-strong tabular-nums">
                  {format.money(plan.pricePaise[interval])}
                </span>
                <span className="text-caption text-muted-foreground">
                  {interval === 'year' ? c.perYearUnit : c.perMonthUnit}
                </span>
              </p>
              <div className="flex flex-col gap-0.5 rounded-md bg-muted px-3 py-2">
                <span className="text-body text-ink-strong">
                  {plan.feeBasisPoints > 0
                    ? c.ordersThen(format.number(plan.orders), feePercent(plan.feeBasisPoints))
                    : c.ordersNoFee(format.number(plan.orders))}
                </span>
                {line ? <span className="text-caption text-muted-foreground">{line}</span> : null}
              </div>
              <ul className="flex flex-col gap-1.5 text-body">
                {[
                  c.staff(format.number(plan.staff)),
                  c.files(String(plan.storageGb)),
                  highlight[p],
                ].map((h) => (
                  <li key={h} className="flex items-start gap-2">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                    {h}
                  </li>
                ))}
              </ul>
              <Button
                loading={busy === p}
                className="mt-auto"
                variant={isCurrent ? 'outline' : p === suggested ? 'default' : 'outline'}
                disabled={isCurrent || busy !== null}
                onClick={() => onChoose(p, interval)}
              >
                {isCurrent ? c.currentPlan : busy === p ? d.switching : c.move(copy.plans[p].name)}
              </Button>
            </section>
          )
        })}
      </div>
      <div id="compare" className="scroll-mt-4">
        <PlanCompareTable />
      </div>
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
        <div className="flex max-w-xl flex-col gap-1">
          <h3 className="text-card-title text-ink-strong">{d.ownIt.title}</h3>
          <p className="text-caption text-muted-foreground">{d.ownIt.body}</p>
        </div>
        <Button
          variant="outline"
          nativeButton={false}
          render={<a href={ownItContactUrl()} target="_blank" rel="noopener noreferrer" />}
        >
          {d.ownIt.action}
        </Button>
      </section>
    </div>
  )
}
