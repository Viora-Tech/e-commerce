'use client'

import type { AutomationUsage } from '@commerce/core/automations'
import { cn } from '@commerce/ui/lib/utils'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { automationsContent } from '@/data/automations'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type UsageMeterProps = { usage: AutomationUsage }

/** Share of the limit, 0–100; null when there is no limit. */
const share = (used: number, limit: number | null) =>
  limit && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : null

/** Plan usage this month: active workflows and runs against the plan's limits, with a nudge near the top. */
export default function UsageMeter({ usage }: UsageMeterProps) {
  // Hooks
  const all = useCopy(automationsContent)
  const fmt = useFormat()

  // Render logic
  const copy = all.usage
  const rows = [
    { label: copy.active, used: usage.activeWorkflows, limit: usage.activeLimit },
    { label: copy.runs, used: usage.runs, limit: usage.runsLimit },
  ]
  const top = Math.max(...rows.map((r) => share(r.used, r.limit) ?? 0))
  const note = top >= 100 ? copy.atLimit : top >= 80 ? copy.nearLimit : null

  return (
    <Card gap={3} inset={4}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-card-title text-ink-strong">{copy.title}</h2>
        <span className="text-caption text-muted-foreground">{copy.growthNote}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((r) => {
          const pct = share(r.used, r.limit)
          return (
            <div key={r.label} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2 text-body">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-medium text-ink-strong tabular-nums">
                  {r.limit === null
                    ? copy.unlimited(fmt.number(r.used))
                    : copy.of(fmt.number(r.used), fmt.number(r.limit))}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={r.label}
                aria-valuemin={0}
                aria-valuemax={r.limit ?? undefined}
                aria-valuenow={r.used}
                className="h-1.5 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className={cn(
                    'h-full rounded-full',
                    (pct ?? 0) >= 100
                      ? 'bg-danger'
                      : (pct ?? 0) >= 80
                        ? 'bg-warning'
                        : 'bg-primary',
                  )}
                  style={{ width: `${pct ?? 0}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
      {note ? (
        <p className="text-caption text-muted-foreground">
          {note}{' '}
          <Link href={routes.settings.billing()} className="font-medium text-ink-strong underline">
            {copy.upgrade}
          </Link>
        </p>
      ) : null}
    </Card>
  )
}
