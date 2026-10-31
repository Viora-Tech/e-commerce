'use client'

import { PLAN_QUOTAS } from '@commerce/ai/client'
import {
  type BillingInterval,
  OWN_IT_PRICES,
  PLAN_IDS,
  PLANS,
  type PlanId,
} from '@commerce/core/billing'
import { CheckIcon, MinusIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { useState } from 'react'
import PillTabs from '@/components/layout/pill-tabs'
import { billingContent } from '@/data/billing'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { feePercent, ownItContactUrl } from '@/lib/billing'

type ComparePlansDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  current: PlanId
  currentInterval: BillingInterval
  /** False while trialing: every plan, the current one too, is a choice. */
  paid: boolean
  busy: PlanId | null
  onChoose: (plan: PlanId, interval: BillingInterval) => void
}

/** Figma "Compare plans": Starter to Scale side by side, monthly or yearly, then Own it. */
export default function ComparePlansDialog({
  open,
  onOpenChange,
  current,
  currentInterval,
  paid,
  busy,
  onChoose,
}: ComparePlansDialogProps) {
  // Hooks
  const copy = useCopy(billingContent)
  const format = useFormat()
  const [interval, setInterval] = useState<BillingInterval>(currentInterval)

  // Helpers
  const tick = (on: boolean) =>
    on ? (
      <CheckIcon className="size-4 text-success" aria-label="Yes" />
    ) : (
      <MinusIcon className="size-4 text-muted-foreground" aria-label="No" />
    )

  // Render logic
  const d = copy.dialog
  const ownIt = OWN_IT_PRICES.india
  const rows: { id: string; label: string; cell: (p: PlanId) => React.ReactNode }[] = [
    { id: 'orders', label: d.rows.orders, cell: (p) => format.number(PLANS[p].orders) },
    { id: 'fee', label: d.rows.fee, cell: (p) => `${feePercent(PLANS[p].feeBasisPoints)}%` },
    {
      id: 'visits',
      label: d.rows.visits,
      cell: (p) => {
        const visits = PLANS[p].visitsPerMonth
        return visits === null ? d.fairUse : format.number(visits)
      },
    },
    { id: 'staff', label: d.rows.staff, cell: (p) => format.number(PLANS[p].staff) },
    {
      id: 'storage',
      label: d.rows.storage,
      cell: (p) => copy.usage.gb(String(PLANS[p].storageGb)),
    },
    {
      id: 'ai',
      label: d.rows.ai,
      cell: (p) => d.aiCredits(format.number(PLAN_QUOTAS[PLANS[p].ai].credits)),
    },
    { id: 'theme', label: d.rows.shopifyTheme, cell: (p) => tick(PLANS[p].features.shopifyTheme) },
    { id: 'mcp', label: d.rows.mcpApi, cell: (p) => tick(PLANS[p].features.mcpApi) },
    { id: 'loc', label: d.rows.multiLocation, cell: (p) => tick(PLANS[p].features.multiLocation) },
    {
      id: 'apps',
      label: d.rows.apps,
      cell: (p) => (PLANS[p].features.allApps ? d.apps.all : d.apps.core),
    },
    { id: 'support', label: d.rows.support, cell: (p) => d.support[PLANS[p].features.support] },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The shell's own sm:max-w-sm beats a plain max-w-*: four plans need the sm: width. */}
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{d.title}</DialogTitle>
          <DialogDescription>{d.subtitle}</DialogDescription>
        </DialogHeader>
        <PillTabs
          variant="segmented"
          value={interval}
          onChange={setInterval}
          tabs={[
            { value: 'month', label: copy.interval.month },
            { value: 'year', label: `${copy.interval.year} · ${copy.yearlySaving}` },
          ]}
        />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {PLAN_IDS.map((p) => {
            const isCurrent = paid && p === current && interval === currentInterval
            const price = PLANS[p].pricePaise[interval]
            return (
              <section
                key={p}
                className={cn(
                  'flex flex-col gap-3 rounded-lg border p-4',
                  isCurrent ? 'border-primary' : 'border-border',
                )}
              >
                <div className="flex flex-col gap-1">
                  <h3 className="text-card-title text-ink-strong">{copy.plans[p].name}</h3>
                  <p className="text-caption text-muted-foreground">{copy.plans[p].blurb}</p>
                </div>
                <p className="text-section-title text-ink-strong tabular-nums">
                  {interval === 'year'
                    ? copy.perYear(format.money(price))
                    : copy.perMonth(format.money(price))}
                  <span className="ml-1 text-caption text-muted-foreground">{copy.gstExtra}</span>
                </p>
                <dl className="flex flex-col divide-y divide-border text-body">
                  {rows.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 py-1.5">
                      <dt className="text-muted-foreground">{r.label}</dt>
                      <dd className="text-right text-foreground">{r.cell(p)}</dd>
                    </div>
                  ))}
                </dl>
                <Button
                  className="mt-auto"
                  variant={isCurrent ? 'outline' : 'default'}
                  disabled={isCurrent || busy !== null}
                  onClick={() => onChoose(p, interval)}
                >
                  {isCurrent ? d.current : busy === p ? d.switching : d.choose(copy.plans[p].name)}
                </Button>
              </section>
            )
          })}
        </div>
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-4">
          <div className="flex max-w-xl flex-col gap-1">
            <h3 className="text-card-title text-ink-strong">{d.ownIt.title}</h3>
            <p className="text-caption text-muted-foreground">{d.ownIt.body}</p>
            <p className="text-body font-medium text-ink-strong tabular-nums">
              {d.ownIt.price(format.money(ownIt.licence), format.money(ownIt.carePerMonth))}
            </p>
          </div>
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href={ownItContactUrl()} target="_blank" rel="noopener noreferrer" />}
          >
            {d.ownIt.action}
          </Button>
        </section>
      </DialogContent>
    </Dialog>
  )
}
