'use client'

import { formatPercent } from '@commerce/money'
import StatTile from '@/components/layout/stat-tile'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { Overview } from './format'

type OverviewTilesProps = {
  overview: Overview
}

const TILE = 'rounded-xl border border-panel-border bg-card'

/** Overview's four tiles (Figma 929:11373): priced live, fell back, answer time, Express share. */
export default function OverviewTiles({ overview }: OverviewTilesProps) {
  // Hooks
  const pages = useCopy(deliveryPagesContent)
  const fmt = useFormat()

  // Helpers
  const label = (id: string) => overview.apps.find((a) => a.id === id)?.label ?? id
  const pct = (part: number, whole: number) =>
    formatPercent(part / whole, { locale: fmt.intl, maximumFractionDigits: 0 })

  // Render logic
  const t = pages.tiles
  const { health, express } = overview
  const live = health.checkouts24h - health.backup24h
  const worst = [...health.apps].sort((a, b) => b.failures - a.failures)[0]
  const slowest = [...health.apps]
    .filter((a) => a.typicalMs !== null)
    .sort((a, b) => (b.typicalMs ?? 0) - (a.typicalMs ?? 0))[0]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile
        className={TILE}
        label={t.live}
        value={health.checkouts24h ? pct(live, health.checkouts24h) : t.empty}
        note={health.checkouts24h ? t.liveNote(live, health.checkouts24h) : t.noCheckouts}
      />
      <StatTile
        className={TILE}
        label={t.backup}
        value={fmt.number(health.backup24h)}
        note={
          worst && worst.failures > 0
            ? t.backupNote(label(worst.providerId), worst.failures)
            : t.backupNone
        }
      />
      <StatTile
        className={TILE}
        label={t.answer}
        value={health.typicalMs === null ? t.empty : t.ms(health.typicalMs)}
        note={
          slowest && health.apps.length > 1
            ? t.answerNote(label(slowest.providerId), t.ms(slowest.typicalMs ?? 0))
            : undefined
        }
      />
      <StatTile
        className={TILE}
        label={t.express}
        value={express.orders ? pct(express.express, express.orders) : t.empty}
        note={
          express.orders
            ? express.averagePaise === null
              ? undefined
              : t.expressNote(fmt.moneyWhole(express.averagePaise))
            : t.noOrders
        }
      />
    </div>
  )
}
