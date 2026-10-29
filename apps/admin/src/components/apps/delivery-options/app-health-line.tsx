'use client'

import type { AppHealth } from '@commerce/core'
import { formatPercent } from '@commerce/money'
import StatusChip from '@/components/layout/status-chip'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy, useFormat } from '@/hooks/use-copy'

type AppHealthLineProps = {
  /** What checkout recorded for this app; undefined when nothing was recorded. */
  health: AppHealth | undefined
}

/** One courier app's health under its chip: success rate, typical latency, last error, breaker. */
export default function AppHealthLine({ health }: AppHealthLineProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const fmt = useFormat()

  // Early returns
  const h = copy.routes.health
  if (!health || (health.calls === 0 && !health.skippedSince)) {
    return <span className="text-caption text-muted-foreground">{h.noCalls}</span>
  }

  // Render logic
  const rate =
    health.successRate === null
      ? null
      : formatPercent(health.successRate, { locale: fmt.intl, maximumFractionDigits: 0 })
  const typical = health.typicalMs === null ? null : h.ms(health.typicalMs)

  return (
    <span className="flex flex-col gap-0.5 text-caption text-muted-foreground">
      {health.skippedSince ? (
        <span className="flex items-center gap-1.5">
          <StatusChip tone="attention">{h.skipped}</StatusChip>
          <span>{h.skippedHelp(fmt.dateTime(health.skippedSince))}</span>
        </span>
      ) : null}
      {rate ? <span>{h.line(rate, typical, health.calls)}</span> : null}
      {health.lastError ? (
        <span className="break-words">
          {h.lastError(fmt.ago(health.lastError.at), health.lastError.message)}
        </span>
      ) : null}
    </span>
  )
}
