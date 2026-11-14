'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import StatStrip from '@/components/layout/stat-strip'
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
  /** The figures did not load: dashes (and the toast), not bars that never fill. */
  const [failed, setFailed] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reloadKey` refetches after an issue
  useEffect(() => {
    let active = true
    setFailed(false)
    api.gstInvoices.queue.stats({ gstRegistrationId: gst }).then(
      (next) => {
        if (active) setStats(next)
      },
      () => {
        if (!active) return
        setFailed(true)
        toast.error(copy.statsFailed)
      },
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
      id: 'issued',
      label: copy.stats.issued,
      value: stats ? fmt.number(stats.issued.count) : dash,
      note: stats ? copy.stats.taxable(fmt.moneyWhole(stats.issued.taxablePaise)) : undefined,
    },
    {
      id: 'waiting',
      label: copy.stats.waiting,
      value: waiting === null ? dash : fmt.number(waiting),
      note: waitingNote,
    },
    {
      id: 'credit-notes',
      label: copy.stats.creditNotes,
      value: stats ? fmt.number(stats.creditNotes.count) : dash,
      note: stats ? fmt.moneyWhole(stats.creditNotes.totalPaise) : undefined,
    },
    {
      id: 'next-number',
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

  // The one joined stat strip every list opens with; grey bars until the first figures arrive.
  return (
    <StatStrip
      loading={stats === null && !failed}
      tiles={tiles.map((t) => ({
        id: t.id,
        label: t.label,
        value: t.value,
        ...(t.note ? { note: t.note } : {}),
      }))}
    />
  )
}
