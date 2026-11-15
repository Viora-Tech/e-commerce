'use client'

import { formatPercent } from '@commerce/money'
import StatStrip from '@/components/layout/stat-strip'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { Overview } from './format'

type OverviewTilesProps = {
  overview: Overview
}

/**
 * Overview's four tiles (Figma 929:11373): priced live, fell back, answer time, Express share,
 * on the one joined StatStrip every overview opens with.
 */
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

  const answerNote =
    slowest && health.apps.length > 1
      ? t.answerNote(label(slowest.providerId), t.ms(slowest.typicalMs ?? 0))
      : undefined
  const expressNote = express.orders
    ? express.averagePaise === null
      ? undefined
      : t.expressNote(fmt.moneyWhole(express.averagePaise))
    : t.noOrders

  return (
    <StatStrip
      tiles={[
        {
          id: 'live',
          label: t.live,
          value: health.checkouts24h ? pct(live, health.checkouts24h) : t.empty,
          note: health.checkouts24h ? t.liveNote(live, health.checkouts24h) : t.noCheckouts,
        },
        {
          id: 'backup',
          label: t.backup,
          value: fmt.number(health.backup24h),
          note:
            worst && worst.failures > 0
              ? t.backupNote(label(worst.providerId), worst.failures)
              : t.backupNone,
        },
        {
          id: 'answer',
          label: t.answer,
          value: health.typicalMs === null ? t.empty : t.ms(health.typicalMs),
          ...(answerNote ? { note: answerNote } : {}),
        },
        {
          id: 'express',
          label: t.express,
          value: express.orders ? pct(express.express, express.orders) : t.empty,
          ...(expressNote ? { note: expressNote } : {}),
        },
      ]}
    />
  )
}
