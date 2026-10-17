'use client'

import type { GrowthOutcomes, OutcomeKind } from '@commerce/api'
import { BadgePercent, LinkIcon, Send, Workflow } from '@commerce/ui/icons'
import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import { growthOverviewContent } from '@/data/growth'
import { useCopy, useFormat } from '@/hooks/use-copy'

type OutcomesCardProps = { outcomes: GrowthOutcomes }

const ICON: Record<OutcomeKind, typeof Send> = {
  campaigns: Send,
  automations: Workflow,
  discounts: BadgePercent,
  links: LinkIcon,
}

/**
 * What marketing earned, split four ways (campaigns, automations, discount codes, links):
 * each one's revenue and orders, its share of the total, and the one that earned the most.
 */
export default function OutcomesCard({ outcomes }: OutcomesCardProps) {
  // Hooks
  const copy = useCopy(growthOverviewContent.outcomes.card)
  const fmt = useFormat()

  // Render logic
  const total = outcomes.earnedPaise

  return (
    <DataCard title={copy.title} subtitle={copy.subtitle(fmt.number(outcomes.earnedOrders))}>
      <ul className="flex flex-col">
        {outcomes.rows.map((row) => {
          const Icon = ICON[row.kind]
          const share = total > 0 ? row.revenuePaise / total : 0
          return (
            <li
              key={row.kind}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 border-line border-t py-3 first:border-t-0"
            >
              <Icon aria-hidden className="size-5 text-muted-foreground" />
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-body-strong text-foreground">{copy.kinds[row.kind]}</span>
                <span className="line-clamp-1 text-caption text-muted-foreground">
                  {row.top ? (
                    row.top.href ? (
                      <Link href={row.top.href} className="hover:text-foreground hover:underline">
                        {copy.top(row.top.name, fmt.money(row.top.revenuePaise))}
                      </Link>
                    ) : (
                      copy.top(row.top.name, fmt.money(row.top.revenuePaise))
                    )
                  ) : row.orders === 0 ? (
                    copy.nothing[row.kind]
                  ) : null}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1 text-right">
                <span className="text-body-strong text-ink-strong tabular-nums">
                  {fmt.money(row.revenuePaise)}
                </span>
                <span className="text-caption text-muted-foreground tabular-nums">
                  {copy.orders(fmt.number(row.orders))}
                </span>
              </div>
              <span className="sr-only">{copy.share(`${Math.round(share * 100)}%`)}</span>
              <div
                aria-hidden
                className="col-span-2 col-start-2 h-1.5 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, share * 100)}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </DataCard>
  )
}
