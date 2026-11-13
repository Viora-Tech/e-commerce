'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import StatTile from '@/components/layout/stat-tile'
import { gstQueuePageContent } from '@/data/gst-queue-page'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type QueueStatsProps = {
  /** The GST number picked at the top; undefined counts every one. */
  gst: string | undefined
  /** Orders in the queue, and how many of them lack an HSN code / need any fixing. */
  waiting: number | null
  needHsn: number
  needFix: number
  /** Bumped after an issue so the month's figures follow. */
  reloadKey: number
}

type Stats = Awaited<ReturnType<typeof api.gstInvoices.queue.stats>>

/**
 * The Queue page's four figures (Figma 928:10728): issued this month with its taxable value,
 * waiting with how many need an HSN code, credit notes this month, and the next number.
 */
export default function QueueStats({ gst, waiting, needHsn, needFix, reloadKey }: QueueStatsProps) {
  // Hooks
  const copy = useCopy(gstQueuePageContent)
  const fmt = useFormat()
  const [stats, setStats] = useState<Stats | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reloadKey` refetches after an issue
  useEffect(() => {
    let active = true
    api.gstInvoices.queue.stats({ gstRegistrationId: gst }).then(
      (next) => active && setStats(next),
      () => active && toast.error(copy.statsFailed),
    )
    return () => {
      active = false
    }
  }, [gst, reloadKey, copy.statsFailed])

  // Render logic
  const dash = copy.none
  const waitingNote =
    waiting === null
      ? undefined
      : needHsn > 0
        ? copy.stats.needHsn(needHsn)
        : needFix > 0
          ? copy.stats.needFix(needFix)
          : waiting > 0
            ? copy.stats.allReady
            : undefined
  const next = stats?.next
  const tiles = [
    {
      label: copy.stats.issued,
      value: stats ? fmt.number(stats.issued.count) : dash,
      note: stats ? copy.stats.taxable(fmt.moneyWhole(stats.issued.taxablePaise)) : undefined,
    },
    {
      label: copy.stats.waiting,
      value: waiting === null ? dash : fmt.number(waiting),
      note: waitingNote,
    },
    {
      label: copy.stats.creditNotes,
      value: stats ? fmt.number(stats.creditNotes.count) : dash,
      note: stats ? fmt.moneyWhole(stats.creditNotes.totalPaise) : undefined,
    },
    {
      label: copy.stats.nextNumber,
      value: stats ? (next?.number ?? dash) : dash,
      note: !stats
        ? undefined
        : !next
          ? copy.stats.noSeries
          : next.resetsAt
            ? copy.stats.resets(fmt.pattern(next.resetsAt, { day: 'numeric', month: 'long' }))
            : copy.stats.neverResets,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="min-w-0 rounded-xl surface-card">
          <StatTile label={t.label} value={t.value} {...(t.note ? { note: t.note } : {})} />
        </div>
      ))}
    </div>
  )
}
