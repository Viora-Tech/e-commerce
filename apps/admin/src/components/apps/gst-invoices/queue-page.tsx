'use client'

import { Eye, Plus, Trash2 } from '@commerce/ui/icons'
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
import DateField from '@/components/fields/date-field'
import PageHeader from '@/components/layout/page-header'
import RelativeTime from '@/components/layout/relative-time'
import TableEmptyRow from '@/components/table/table-empty-row'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'
import { routes } from '@/lib/routes'
import GstNumberPicker from './gst-number-picker'
import ReviewPanel from './review-panel'
import { CELL, HEAD } from './table-classes'

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
  const [gst, setGst] = useState<string | undefined>(undefined)

  useEffect(() => {
    api.gstInvoices.settings
      .get()
      .then((s) => setGstin(s.settings.seller.gstin || null))
      .catch(() => setGstin(null))
  }, [])

  useEffect(() => {
    let cancelled = false
    api.gstInvoices.queue
      .list({ from: istStart(range.from), to: istEnd(range.to), gstRegistrationId: gst })
      .then((r) => {
        if (!cancelled) setRows(r)
      })
    return () => {
      cancelled = true
    }
  }, [range, gst])

  // Helpers
  const reload = async () => {
    setRows(
      await api.gstInvoices.queue.list({
        from: istStart(range.from),
        to: istEnd(range.to),
        gstRegistrationId: gst,
      }),
    )
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
  const handleGst = (id: string | undefined) => {
    setGst(id)
    setPicked(new Set())
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
      <PageHeader
        title={copy.title}
        summary={copy.subtitle}
        actions={<GstNumberPicker value={gst} onChange={handleGst} allowAll />}
      />
      {gstin === null ? (
        <SetupChecklist
          heading={copy.setup.heading}
          body={copy.setup.body}
          steps={[
            {
              label: copy.setup.gstin,
              done: false,
              href: routes.apps.page('gst-invoices', 'settings'),
              action: copy.setup.gstinAction,
            },
          ]}
        />
      ) : null}
      <div className="overflow-hidden rounded-xl surface-card">
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
                <Plus aria-hidden="true" />
                {copy.add}
              </Button>
            </div>
            <DateField
              aria-label={copy.from}
              value={range.from}
              onChange={(v) => setRange((r) => ({ ...r, from: v }))}
            />
            <DateField
              aria-label={copy.to}
              value={range.to}
              onChange={(v) => setRange((r) => ({ ...r, to: v }))}
            />
          </div>
          {picked.size ? (
            <div className="flex flex-wrap items-center gap-2 rounded-[0.5rem] bg-secondary px-3 py-2">
              <span className="text-body">{copy.selected(picked.size)}</span>
              <span className="flex-1" />
              <Button size="sm" variant="outline" disabled={busy} onClick={handleRemove}>
                <Trash2 aria-hidden="true" />
                {copy.remove}
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => setReviewing(list.filter((r) => picked.has(r.id)))}
              >
                <Eye aria-hidden="true" />
                {copy.review}
              </Button>
            </div>
          ) : null}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={`${HEAD} w-10`}>
                <Checkbox
                  checked={allOn}
                  aria-label={copy.review}
                  onCheckedChange={(v) => setPicked(v ? new Set(list.map((r) => r.id)) : new Set())}
                />
              </TableHead>
              <TableHead className={HEAD}>{copy.columns.order}</TableHead>
              <TableHead className={HEAD}>{copy.columns.buyer}</TableHead>
              <TableHead className={HEAD}>{copy.columns.eligible}</TableHead>
              <TableHead className={HEAD}>{copy.columns.dispatched}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{copy.columns.total}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows && list.length === 0 ? <TableEmptyRow colSpan={6} message={copy.empty} /> : null}
            {list.map((r) => (
              <TableRow key={r.id}>
                <TableCell className={CELL}>
                  <Checkbox
                    checked={picked.has(r.id)}
                    aria-label={r.orderName}
                    onCheckedChange={(v) => handleToggle(r.id, Boolean(v))}
                  />
                </TableCell>
                <TableCell className={`${CELL} font-medium`}>
                  <Link href={routes.orders.detail(r.orderId)} className="hover:underline">
                    {r.orderName}
                  </Link>
                </TableCell>
                <TableCell className={CELL}>
                  <span className="flex flex-col">
                    {r.buyerName}
                    <span className="text-caption text-muted-foreground">
                      {r.export ? copy.export(r.export) : (r.buyerGstin ?? '')}
                    </span>
                  </span>
                </TableCell>
                <TableCell className={CELL}>
                  {r.eligibleAt ? <RelativeTime value={r.eligibleAt} /> : '-'}
                </TableCell>
                <TableCell className={CELL}>
                  {r.dispatchedAt ? <RelativeTime value={r.dispatchedAt} /> : '-'}
                </TableCell>
                <TableCell className={`${CELL} text-right tabular-nums`}>
                  {formatPaise(r.totalPaise)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
