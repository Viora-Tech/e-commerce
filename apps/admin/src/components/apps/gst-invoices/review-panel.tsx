'use client'

import { dayKey } from '@commerce/dates'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { SortableList } from '@commerce/ui/sortable'
import { useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import { reorderLabels } from '@/data/common'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'
import type { QueueRow } from './queue-page'

type ReviewPanelProps = {
  rows: QueueRow[]
  onBack: () => void
  onIssued: (count: number) => void
}

type Item = { row: QueueRow; day: string }

const copy = gstInvoicesContent.queue

/** yyyy-mm-dd of an instant in IST. */
function istDay(at: Date | string): string {
  return dayKey(new Date(at))
}

/** Midday IST on a day, so a date never slips across midnight. */
const atIstNoon = (day: string) => new Date(`${day}T12:00:00+05:30`)

/**
 * Review and issue: confirm each invoice date, see the numbers they will
 * get, then issue. Rows on the same date can be reordered; nothing has a
 * number until Issue.
 */
export default function ReviewPanel({ rows, onBack, onIssued }: ReviewPanelProps) {
  // Hooks
  const sortLabels = useCopy(reorderLabels)
  const [items, setItems] = useState<Item[]>(() =>
    rows.map((row) => ({ row, day: istDay(row.defaultDate) })),
  )
  const [numbers, setNumbers] = useState<Record<string, string> | null>(null)
  const [busy, setBusy] = useState(false)

  // Helpers
  const payload = () => ({
    items: items.map((i) => ({
      id: i.row.id,
      invoiceDate: i.day === istDay(new Date()) ? new Date() : atIstNoon(i.day),
    })),
  })
  const call = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Event handlers
  const handleDay = (index: number, day: string) => {
    setNumbers(null)
    setItems((list) => list.map((it, i) => (i === index ? { ...it, day } : it)))
  }
  const handleReorder = (next: { id: string; item: Item }[]) => {
    setNumbers(null)
    setItems(next.map((n) => n.item))
  }
  const handlePreview = () =>
    call(async () => {
      const plan = (await api.gstInvoices.queue.preview(payload())) ?? []
      setNumbers(Object.fromEntries(plan.map((p) => [p.id, p.number])))
      // Show rows in the order they will be numbered.
      const order = new Map(plan.map((p, i) => [p.id, i]))
      setItems((list) =>
        [...list].sort((x, y) => (order.get(x.row.id) ?? 0) - (order.get(y.row.id) ?? 0)),
      )
    })
  const handleIssue = () =>
    call(async () => {
      const plan = (await api.gstInvoices.queue.issue(payload())) ?? []
      onIssued(plan.length)
    })

  return (
    <DataCard title={copy.review}>
      <div className="flex flex-col gap-3">
        <p className="text-body text-muted-foreground">{copy.reviewBody}</p>
        <SortableList
          items={items.map((item) => ({ id: item.row.id, item }))}
          onReorder={handleReorder}
          getTitle={({ item }) => item.row.orderName}
          labels={sortLabels}
          className="flex flex-col gap-3"
          itemClassName="rounded-[0.5rem]"
          renderItem={({ item: it }, { handle }) => {
            const i = items.indexOf(it)
            return (
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-[0.5rem] border border-border p-2.5 pl-1 sm:grid-cols-[auto_1fr_10rem_9rem]">
                {handle}
                <span className="flex flex-col">
                  <span className="text-body font-medium">{it.row.orderName}</span>
                  <span className="text-caption text-muted-foreground">
                    {it.row.buyerName}, {formatPaise(it.row.totalPaise)}
                  </span>
                </span>
                <Input
                  size="lg"
                  type="date"
                  aria-label={copy.invoiceDate}
                  className="col-span-2 sm:col-span-1"
                  value={it.day}
                  max={istDay(new Date())}
                  onChange={(e) => handleDay(i, e.target.value)}
                />
                <span className="col-span-2 font-mono text-caption sm:col-span-1">
                  {numbers?.[it.row.id] ?? '-'}
                </span>
              </div>
            )
          }}
        />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onBack} disabled={busy}>
            {copy.back}
          </Button>
          <Button variant="outline" onClick={handlePreview} disabled={busy}>
            {copy.preview}
          </Button>
          <Button onClick={handleIssue} disabled={busy || !numbers}>
            {copy.confirm(items.length)}
          </Button>
        </div>
      </div>
    </DataCard>
  )
}
