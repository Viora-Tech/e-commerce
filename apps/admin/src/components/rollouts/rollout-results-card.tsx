'use client'

import type { AbArmResult, RolloutAbResults, RolloutView } from '@commerce/core'
import { TrendingUp } from '@commerce/ui/icons'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import DataCard from '@/components/layout/data-card'
import { rolloutsContent } from '@/data/rollouts'
import { useCopy, useFormat } from '@/hooks/use-copy'

type RolloutResultsCardProps = {
  results: RolloutAbResults
  /** An ended test: which arm the store kept. */
  outcome: RolloutView['abOutcome']
}

/** The ring's radius and circumference, in the SVG's own units. */
const RADIUS = 42
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** A number column; the leading arm's in bold. */
const cellClass = (leads: boolean): string =>
  leads ? 'text-right font-semibold tabular-nums' : 'text-right tabular-nums'

const percent = (share: number): string => `${(share * 100).toFixed(1)}%`

const METRICS = [
  'visitors',
  'sessions',
  'addToCart',
  'conversion',
  'orders',
  'revenuePerVisitor',
] as const
type MetricKey = (typeof METRICS)[number]

/**
 * An A/B rollout's results: the "Reached" ring (visitors drawn vs the target), each arm's
 * sessions, add-to-cart rate, conversion and revenue per visitor, and the z-test hint.
 */
export default function RolloutResultsCard({ results, outcome }: RolloutResultsCardProps) {
  // Hooks
  const { form } = useCopy(rolloutsContent)
  const fmt = useFormat()

  // Helpers
  const cell = (arm: AbArmResult, key: MetricKey): string => {
    if (key === 'visitors') return fmt.number(arm.visitors)
    if (key === 'sessions') return fmt.number(arm.sessions)
    if (key === 'addToCart') return percent(arm.addToCartRate)
    if (key === 'conversion') return percent(arm.conversionRate)
    if (key === 'orders') return fmt.number(arm.orders)
    return fmt.money(arm.revenuePerVisitorMinor)
  }

  // Render logic
  const { results: copy, audience } = form
  const { reached, target, verdict } = results
  const share = target ? Math.min(1, reached / target) : reached > 0 ? 1 : 0
  const reachedLabel = target
    ? copy.reachedOf(fmt.number(reached), fmt.number(target))
    : copy.reachedCount(fmt.number(reached))
  const leader = verdict.kind === 'ahead' ? verdict.arm : null
  const verdictText =
    verdict.kind === 'ahead'
      ? copy.verdict.ahead(audience[verdict.arm], verdict.confidence)
      : copy.verdict[verdict.kind]

  return (
    <DataCard title={copy.heading} subtitle={copy.subtitle}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="relative size-24 shrink-0">
            <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
              <circle
                cx="50"
                cy="50"
                r={RADIUS}
                fill="none"
                strokeWidth="10"
                className="stroke-muted"
              />
              <circle
                cx="50"
                cy="50"
                r={RADIUS}
                fill="none"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={CIRCUMFERENCE * (1 - share)}
                className="stroke-primary transition-[stroke-dashoffset] duration-500 ease-out"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-body font-semibold tabular-nums">
              {target ? `${Math.round(share * 100)}%` : fmt.compact(reached)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-caption text-muted-foreground">{copy.reached}</span>
            <span className="text-body font-medium text-foreground">{reachedLabel}</span>
            <span className="flex items-center gap-2 text-body text-foreground">
              <TrendingUp aria-hidden="true" className="size-4 text-muted-foreground" />
              {outcome ? copy.outcome[outcome] : verdictText}
            </span>
            {outcome ? null : (
              <span className="text-caption text-muted-foreground">{copy.verdictHelp}</span>
            )}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{copy.metric}</TableHead>
              <TableHead className="text-right">{audience.control}</TableHead>
              <TableHead className="text-right">{audience.treatment}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {METRICS.map((key) => (
              <TableRow key={key}>
                <TableCell className="text-muted-foreground">{copy.metrics[key]}</TableCell>
                <TableCell className={cellClass(leader === 'control')}>
                  {cell(results.control, key)}
                </TableCell>
                <TableCell className={cellClass(leader === 'treatment')}>
                  {cell(results.treatment, key)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DataCard>
  )
}
