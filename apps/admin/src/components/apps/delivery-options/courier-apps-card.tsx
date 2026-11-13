'use client'

import AppLogo from '@/components/apps/app-logo'
import AppStoreLink from '@/components/apps/app-store-link'
import StatusChip from '@/components/layout/status-chip'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { Overview, RouteCatalogue } from './format'

type CourierAppsCardProps = {
  overview: Overview
  /** Every route the apps offer, for the couriers each aggregator brings; null while loading. */
  catalogue: RouteCatalogue | null
}

const TIME = { hour: '2-digit', minute: '2-digit', hour12: false } as const

/** Overview: each connected courier app and how it answers checkout (Figma 929:11373). */
export default function CourierAppsCard({ overview, catalogue }: CourierAppsCardProps) {
  // Hooks
  const pages = useCopy(deliveryPagesContent)
  const fmt = useFormat()

  // Render logic
  const a = pages.apps
  const now = Date.now()
  const rows = overview.apps.map((app) => {
    const h = overview.health.apps.find((x) => x.providerId === app.id)
    const carriers = new Set(
      (catalogue?.routes ?? []).filter((r) => r.providerId === app.id).map((r) => r.carrierKey),
    )
    const rate = h?.successRate == null ? null : `${Math.round(h.successRate * 100)}%`
    const time = h?.typicalMs == null ? null : pages.tiles.ms(h.typicalMs)
    const skipped = h?.skippedSince
      ? Math.max(1, Math.round((now - Date.parse(h.skippedSince)) / 60_000))
      : null
    const parts = [
      skipped && h?.lastError
        ? a.timeouts(h.failures, fmt.pattern(h.lastError.at, TIME))
        : rate
          ? a.line(rate, time)
          : app.prices
            ? a.quiet
            : a.noPrice,
      app.channel === 'aggregator' && carriers.size > 0 ? a.couriers(carriers.size) : null,
    ].filter(Boolean)
    return { app, skipped, answering: !skipped && (h?.calls ?? 0) > 0, line: parts.join(' · ') }
  })

  return (
    <section className="flex flex-col rounded-xl border border-panel-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <h2 className="text-card-title text-ink-strong">{a.title}</h2>
        <AppStoreLink category="shipping" variant="ghost" size="sm">
          {a.connect}
        </AppStoreLink>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-3 text-body text-muted-foreground">{a.none}</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map(({ app, skipped, answering, line }) => (
            <li
              key={app.id}
              className="flex items-center gap-3 border-t border-hairline px-4 py-3 first:border-t-0"
            >
              <AppLogo id={app.id} icon={null} size={28} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body font-medium text-ink-strong">{app.label}</span>
                <span className="truncate text-caption text-muted-foreground">{line}</span>
              </span>
              {skipped ? (
                <StatusChip tone="attention">{a.skipped(skipped)}</StatusChip>
              ) : answering ? (
                <StatusChip tone="success">{a.answering}</StatusChip>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
