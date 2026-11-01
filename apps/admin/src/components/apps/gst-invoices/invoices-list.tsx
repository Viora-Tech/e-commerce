'use client'

import { DOCUMENT_KINDS, type DocumentKind } from '@commerce/invoices'
import { Download, Printer, Send } from '@commerce/ui/icons'
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
import CopyButton from '@/components/fields/copy-button'
import DateField from '@/components/fields/date-field'
import PageHeader from '@/components/layout/page-header'
import RelativeTime from '@/components/layout/relative-time'
import OrderChip from '@/components/orders/order-chip'
import TableEmptyRow from '@/components/table/table-empty-row'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'
import { routes } from '@/lib/routes'
import ChoiceField from './choice-field'
import GstNumberPicker from './gst-number-picker'
import { saveFile } from './save-file'
import { CELL, HEAD } from './table-classes'

type Page = Awaited<ReturnType<typeof api.gstInvoices.list>>
type Progress = { batchId: string; total: number; sent: number; failed: number }

const copy = gstInvoicesContent.list
const kindCopy = gstInvoicesContent.kinds
const ALL = 'all'
const KIND_OPTIONS = [
  { value: ALL, label: copy.all },
  ...DOCUMENT_KINDS.map((k) => ({ value: k, label: kindCopy[k] })),
]

/** yyyy-mm-dd of the first of this month and today, in the browser's zone. */
function monthRange(now = new Date()): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, '0')
  const d = (y: number, m: number, day: number) => `${y}-${pad(m + 1)}-${pad(day)}`
  return {
    from: d(now.getFullYear(), now.getMonth(), 1),
    to: d(now.getFullYear(), now.getMonth(), now.getDate()),
  }
}

/** Midnight IST at the start of a yyyy-mm-dd, and of the day after for an exclusive end. */
const istStart = (day: string) => new Date(`${day}T00:00:00+05:30`)
const istEnd = (day: string) => new Date(istStart(day).getTime() + 86_400_000)

function filterOf(
  q: string,
  kind: string,
  range: { from: string; to: string },
  gst: string | undefined,
) {
  return {
    q: q.trim() || undefined,
    kind: kind === ALL ? undefined : (kind as DocumentKind),
    from: range.from ? istStart(range.from) : undefined,
    to: range.to ? istEnd(range.to) : undefined,
    gstRegistrationId: gst,
  }
}

/** Issued documents with search, date range, bulk zip, print, email and GSTR-1 export. */
export default function InvoicesList() {
  // Hooks
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<string>(ALL)
  const [range, setRange] = useState(monthRange)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Page | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [everything, setEverything] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [gst, setGst] = useState<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      api.gstInvoices.list({ ...filterOf(q, kind, range, gst), page }).then((d) => {
        if (!cancelled) setData(d)
      })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [q, kind, range, page, gst])

  useEffect(() => {
    if (!progress || progress.sent + progress.failed >= progress.total) return
    const timer = setTimeout(async () => {
      const b = await api.gstInvoices.batch({ id: progress.batchId })
      setProgress({ ...progress, sent: b.sent, failed: b.failed })
    }, 2000)
    return () => clearTimeout(timer)
  }, [progress])

  // Helpers
  const selection = () =>
    everything ? { filter: filterOf(q, kind, range, gst) } : { ids: [...picked] }
  const bulk = async (fn: () => Promise<void>) => {
    setBusy(true)
    const id = toast.loading(copy.working)
    try {
      await fn()
      toast.dismiss(id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed, { id })
    } finally {
      setBusy(false)
    }
  }

  // Event handlers
  const handleToggle = (id: string, on: boolean) => {
    setEverything(false)
    setPicked((p) => {
      const next = new Set(p)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }
  const handleGst = (id: string | undefined) => {
    setGst(id)
    setPage(1)
    setPicked(new Set())
    setEverything(false)
  }
  const handleTogglePage = (on: boolean) => {
    setEverything(false)
    setPicked(on ? new Set(data?.rows.map((r) => r.id)) : new Set())
  }
  const handleDownload = () =>
    bulk(async () => saveFile(await api.gstInvoices.bulkDownload(selection())))
  const handlePrint = () =>
    bulk(async () => saveFile(await api.gstInvoices.bulkPrint(selection()), 'open'))
  const handleEmail = () =>
    bulk(async () => {
      const r = await api.gstInvoices.bulkEmail(selection())
      setProgress({ batchId: r.batchId, total: r.total, sent: 0, failed: 0 })
      toast.success(copy.emailQueued(r.total))
    })

  // Render logic
  const rows = data?.rows ?? []
  const count = everything ? null : picked.size
  const anySelected = everything || picked.size > 0
  const allOnPage = rows.length > 0 && rows.every((r) => picked.has(r.id))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={copy.title}
        summary={copy.subtitle}
        actions={<GstNumberPicker value={gst} onChange={handleGst} allowAll />}
      />
      <div className="overflow-hidden rounded-xl surface-card">
        <div className="flex flex-col gap-3 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_12rem_10rem_10rem]">
            <Input
              size="lg"
              placeholder={copy.search}
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
            />
            <ChoiceField
              id="inv-kind"
              label={copy.all}
              value={kind}
              options={KIND_OPTIONS}
              onChange={(v) => {
                setKind(v)
                setPage(1)
              }}
            />
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
          {anySelected ? (
            <div className="flex flex-wrap items-center gap-2 rounded-[0.5rem] bg-secondary px-3 py-2">
              <span className="text-body">
                {count === null ? copy.allSelected : copy.selected(count)}
              </span>
              {!everything && data?.hasMore ? (
                <Button variant="link" size="sm" onClick={() => setEverything(true)}>
                  {copy.selectAll}
                </Button>
              ) : null}
              <span className="flex-1" />
              <Button size="sm" variant="outline" disabled={busy} onClick={handleDownload}>
                <Download />
                {copy.download}
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={handlePrint}>
                <Printer />
                {copy.print}
              </Button>
              <Button size="sm" disabled={busy} onClick={handleEmail}>
                <Send />
                {copy.email}
              </Button>
            </div>
          ) : null}
          {progress ? (
            <p className="text-caption text-muted-foreground">
              {copy.emailProgress(progress.sent, progress.failed, progress.total)}
            </p>
          ) : null}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={`${HEAD} w-10`}>
                <Checkbox
                  checked={allOnPage || everything}
                  onCheckedChange={(v) => handleTogglePage(Boolean(v))}
                  aria-label={copy.selectAll}
                />
              </TableHead>
              <TableHead className={HEAD}>{copy.columns.number}</TableHead>
              <TableHead className={HEAD}>{copy.columns.kind}</TableHead>
              <TableHead className={HEAD}>{copy.columns.order}</TableHead>
              <TableHead className={HEAD}>{copy.columns.buyer}</TableHead>
              <TableHead className={HEAD}>{copy.columns.date}</TableHead>
              <TableHead className={`${HEAD} text-center`}>{copy.columns.status}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{copy.columns.tax}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{copy.columns.total}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? <TableEmptyRow colSpan={9} message={copy.empty} /> : null}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className={CELL}>
                  <Checkbox
                    checked={everything || picked.has(r.id)}
                    onCheckedChange={(v) => handleToggle(r.id, Boolean(v))}
                    aria-label={r.number ?? r.orderName}
                  />
                </TableCell>
                <TableCell className={`${CELL} font-medium`}>
                  <span className="group/row flex items-center gap-1">
                    <Link
                      href={routes.apps.page('gst-invoices', 'invoices', r.id)}
                      className="hover:underline"
                    >
                      {r.number ?? '-'}
                    </Link>
                    {r.number ? <CopyButton value={r.number} what={copy.columns.number} /> : null}
                  </span>
                </TableCell>
                <TableCell className={CELL}>{kindCopy[r.kind]}</TableCell>
                <TableCell className={CELL}>
                  <Link href={routes.orders.detail(r.orderId)} className="hover:underline">
                    {r.orderName}
                  </Link>
                </TableCell>
                <TableCell className={CELL}>
                  <span className="flex flex-col">
                    {r.buyerName}
                    {r.buyerGstin ? (
                      <span className="text-caption text-muted-foreground">{r.buyerGstin}</span>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell className={CELL}>
                  <RelativeTime value={r.invoiceDate ?? r.issuedAt} />
                </TableCell>
                <TableCell className={`${CELL} text-center`}>
                  <OrderChip kind="gstDoc" value={r.status} />
                </TableCell>
                <TableCell className={`${CELL} text-right tabular-nums`}>
                  {formatPaise(r.taxPaise)}
                </TableCell>
                <TableCell className={`${CELL} text-right tabular-nums`}>
                  {formatPaise(r.totalPaise)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex justify-end gap-2 border-t border-line p-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {copy.previous}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!data?.hasMore}
            onClick={() => setPage((p) => p + 1)}
          >
            {copy.next}
          </Button>
        </div>
      </div>
    </div>
  )
}
