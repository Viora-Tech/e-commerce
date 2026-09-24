'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import SetupChecklist from '@/components/apps/setup-checklist'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import RelativeTime from '@/components/layout/relative-time'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'
import ReviewPanel from './review-panel'

export type QueueRow = Awaited<ReturnType<typeof api.gstInvoices.queue.list>>[number]

const copy = gstInvoicesContent.queue

const istStart = (day: string) => (day ? new Date(`${day}T00:00:00+05:30`) : undefined)
const istEnd = (day: string) =>
  day ? new Date(new Date(`${day}T00:00:00+05:30`).getTime() + 86_400_000) : undefined

/** Order numbers typed as "1042, 1043 1044". */
const parseNumbers = (text: string) =>
  [...new Set(text.split(/[\s,#]+/).map(Number))].filter((n) => Number.isInteger(n) && n > 0)

/**
 * The app's main page: orders waiting for a tax invoice. Select, review the
 * dates, see the numbers they will get, issue. Nothing here is numbered.
 */
export default function QueuePage() {
  // Hooks
  const [rows, setRows] = useState<QueueRow[] | null>(null)
  const [range, setRange] = useState({ from: '', to: '' })
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState('')
  const [reviewing, setReviewing] = useState<QueueRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [gstin, setGstin] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    api.gstInvoices.settings
      .get()
      .then((s) => setGstin(s.settings.seller.gstin || null))
      .catch(() => setGstin(null))
  }, [])

  useEffect(() => {
    let cancelled = false
    api.gstInvoices.queue.list({ from: istStart(range.from), to: istEnd(range.to) }).then((r) => {
      if (!cancelled) setRows(r)
    })
    return () => {
      cancelled = true
    }
  }, [range])

  // Helpers
  const reload = async () => {
    setRows(await api.gstInvoices.queue.list({ from: istStart(range.from), to: istEnd(range.to) }))
    setPicked(new Set())
  }

  // Event handlers
  const handleToggle = (id: string, on: boolean) =>
    setPicked((p) => {
      const next = new Set(p)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  const handleAdd = async () => {
    const numbers = parseNumbers(adding)
    if (!numbers.length) return
    setBusy(true)
    try {
      const r = await api.gstInvoices.queue.add({ orderNumbers: numbers })
      toast.success(copy.added(r?.added ?? 0))
      if (r?.missing.length) toast.error(copy.notFound(r.missing.join(', ')))
      setAdding('')
      await reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }
  const handleRemove = async () => {
    setBusy(true)
    try {
      await api.gstInvoices.queue.remove({ ids: [...picked] })
      await reload()
    } finally {
      setBusy(false)
    }
  }
  const handleIssued = async (n: number) => {
    toast.success(copy.issued(n))
    setReviewing(null)
    await reload()
  }

  // Early returns
  if (reviewing) {
    return (
      <ReviewPanel rows={reviewing} onBack={() => setReviewing(null)} onIssued={handleIssued} />
    )
  }

  // Render logic
  const list = rows ?? []
  const allOn = list.length > 0 && list.every((r) => picked.has(r.id))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={copy.title} subtitle={copy.subtitle} />
      {gstin === null ? (
        <SetupChecklist
          heading={copy.setup.heading}
          body={copy.setup.body}
          steps={[
            {
              label: copy.setup.gstin,
              done: false,
              href: '/apps/gst-invoices/settings',
              action: copy.setup.gstinAction,
            },
          ]}
        />
      ) : null}
      <DataCard title={copy.title} flush>
        <div className="flex flex-col gap-3 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_10rem_10rem]">
            <div className="flex gap-2">
              <Input
                size="lg"
                placeholder={copy.addPlaceholder}
                value={adding}
                onChange={(e) => setAdding(e.target.value)}
              />
              <Button variant="outline" disabled={busy || !adding.trim()} onClick={handleAdd}>
                {copy.add}
              </Button>
            </div>
            <Input
              size="lg"
              type="date"
              aria-label={copy.from}
              value={range.from}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            />
            <Input
              size="lg"
              type="date"
              aria-label={copy.to}
              value={range.to}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            />
          </div>
          {picked.size ? (
            <div className="flex flex-wrap items-center gap-2 rounded-[0.5rem] bg-secondary px-3 py-2">
              <span className="text-body">{copy.selected(picked.size)}</span>
              <span className="flex-1" />
              <Button size="sm" variant="outline" disabled={busy} onClick={handleRemove}>
                {copy.remove}
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => setReviewing(list.filter((r) => picked.has(r.id)))}
              >
                {copy.review}
              </Button>
            </div>
          ) : null}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allOn}
                  aria-label={copy.review}
                  onCheckedChange={(v) => setPicked(v ? new Set(list.map((r) => r.id)) : new Set())}
                />
              </TableHead>
              <TableHead>{copy.columns.order}</TableHead>
              <TableHead>{copy.columns.buyer}</TableHead>
              <TableHead>{copy.columns.eligible}</TableHead>
              <TableHead>{copy.columns.dispatched}</TableHead>
              <TableHead className="text-right">{copy.columns.total}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows && list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {copy.empty}
                </TableCell>
              </TableRow>
            ) : null}
            {list.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Checkbox
                    checked={picked.has(r.id)}
                    aria-label={r.orderName}
                    onCheckedChange={(v) => handleToggle(r.id, Boolean(v))}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/orders/${r.orderId}`} className="hover:underline">
                    {r.orderName}
                  </Link>
                </TableCell>
                <TableCell>
                  <span className="flex flex-col">
                    {r.buyerName}
                    <span className="text-caption text-muted-foreground">
                      {r.export ? copy.export(r.export) : (r.buyerGstin ?? '')}
                    </span>
                  </span>
                </TableCell>
                <TableCell>{r.eligibleAt ? <RelativeTime value={r.eligibleAt} /> : '-'}</TableCell>
                <TableCell>
                  {r.dispatchedAt ? <RelativeTime value={r.dispatchedAt} /> : '-'}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPaise(r.totalPaise)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataCard>
    </div>
  )
}
