'use client'

import type { DocumentKind } from '@commerce/invoices'
import { ChevronLeftIcon, ChevronRightIcon, Download, Printer, Send } from '@commerce/ui/icons'
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
import PageHeader from '@/components/layout/page-header'
import PillTabs from '@/components/layout/pill-tabs'
import RelativeTime from '@/components/layout/relative-time'
import OrderChip from '@/components/orders/order-chip'
import TableEmptyRow from '@/components/table/table-empty-row'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { api } from '@/lib/api-client'
import { formatPattern } from '@/lib/format-date'
import { formatPaise } from '@/lib/money'
import { routes } from '@/lib/routes'
import GstNumberPicker from './gst-number-picker'
import { saveFile } from './save-file'
import { CELL, HEAD } from './table-classes'

type Page = Awaited<ReturnType<typeof api.gstInvoices.list>>
type Progress = { batchId: string; total: number; sent: number; failed: number }

const copy = gstInvoicesContent.list
const kindCopy = gstInvoicesContent.kinds
/** The list's tabs: GST returns treat invoices, notes and vouchers apart. */
const TABS = ['tax_invoice', 'credit_note', 'vouchers', 'all'] as const
type Tab = (typeof TABS)[number]

const TAB_KINDS: Record<Tab, DocumentKind[] | undefined> = {
  tax_invoice: ['tax_invoice'],
  credit_note: ['credit_note'],
  vouchers: ['receipt_voucher', 'refund_voucher'],
  all: undefined,
}

/** A calendar month: GST is filed month by month. */
type Month = { year: number; month: number }

const thisMonth = (now = new Date()): Month => ({ year: now.getFullYear(), month: now.getMonth() })

const shift = (m: Month, by: number): Month => {
  const d = new Date(m.year, m.month + by, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

/** yyyy-mm-dd of the month's first and last day. */
function monthRange(m: Month): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, '0')
  const last = new Date(m.year, m.month + 1, 0).getDate()
  return {
    from: `${m.year}-${pad(m.month + 1)}-01`,
    to: `${m.year}-${pad(m.month + 1)}-${pad(last)}`,
  }
}

const monthLabel = (m: Month) =>
  formatPattern(new Date(m.year, m.month, 15), { month: 'long', year: 'numeric' })

/** Midnight IST at the start of a yyyy-mm-dd, and of the day after for an exclusive end. */
const istStart = (day: string) => new Date(`${day}T00:00:00+05:30`)
const istEnd = (day: string) => new Date(istStart(day).getTime() + 86_400_000)

function filterOf(q: string, tab: Tab, month: Month, gst: string | undefined) {
  const range = monthRange(month)
  return {
    q: q.trim() || undefined,
    kind: TAB_KINDS[tab],
    from: istStart(range.from),
    to: istEnd(range.to),
    gstRegistrationId: gst,
  }
}

/** Issued documents by type and month, with search, bulk zip, print, email and GSTR-1 export. */
export default function InvoicesList() {
  // Hooks
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<Tab>('tax_invoice')
  const [month, setMonth] = useState(thisMonth)
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
      api.gstInvoices.list({ ...filterOf(q, tab, month, gst), page }).then((d) => {
        if (!cancelled) setData(d)
      })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [q, tab, month, page, gst])

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
    everything ? { filter: filterOf(q, tab, month, gst) } : { ids: [...picked] }
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
  /** A new tab or month starts from page one with nothing picked. */
  const handleView = (next: { tab?: Tab; month?: Month }) => {
    if (next.tab) setTab(next.tab)
    if (next.month) setMonth(next.month)
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
  const latest = thisMonth()
  const atLatest = month.year === latest.year && month.month === latest.month

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={copy.title}
        summary={copy.subtitle}
        actions={<GstNumberPicker value={gst} onChange={handleGst} allowAll />}
      />
      <div className="overflow-hidden rounded-xl surface-card">
        <div className="flex flex-col gap-3 p-4">
          <PillTabs<Tab>
            value={tab}
            onChange={(t) => handleView({ tab: t })}
            tabs={TABS.map((t) => ({ value: t, label: copy.tabs[t] }))}
          />
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <Input
              size="lg"
              placeholder={copy.search}
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
            />
            {/* One month at a time, the way GSTR-1 and GSTR-3B are filed. */}
            <fieldset className="flex items-center gap-1" aria-label={copy.month}>
              <Button
                variant="outline"
                size="icon"
                aria-label={copy.previousMonth}
                onClick={() => handleView({ month: shift(month, -1) })}
              >
                <ChevronLeftIcon />
              </Button>
              <span className="min-w-36 text-center text-body font-medium tabular-nums">
                {monthLabel(month)}
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label={copy.nextMonth}
                disabled={atLatest}
                onClick={() => handleView({ month: shift(month, 1) })}
              >
                <ChevronRightIcon />
              </Button>
            </fieldset>
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
