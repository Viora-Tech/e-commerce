'use client'

import { validateGstin } from '@commerce/core/gstin'
import { Download, FileText, RefreshCw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { api } from '@/lib/api-client'
import { formatDay } from '@/lib/format-date'
import { formatPaise } from '@/lib/money'
import { saveFile } from './save-file'

type OrderCardProps = { orderId: string }

type Data = Awaited<ReturnType<typeof api.gstInvoices.forOrder>>

const copy = gstInvoicesContent.orderCard
const APP = '/apps/gst-invoices'

const cleanGstin = (v: string) => (v.trim() ? v.trim().toUpperCase() : null)

/**
 * GST documents on the order page: queue the order for invoicing, download
 * what was issued, add a buyer GSTIN, credit notes for refunds, slips.
 */
export default function OrderCard({ orderId }: OrderCardProps) {
  // Hooks
  const [data, setData] = useState<Data | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [gstin, setGstin] = useState('')

  useEffect(() => {
    api.gstInvoices.forOrder({ orderId }).then((d) => {
      setData(d)
      setGstin(d.documents.find((x) => x.kind === 'tax_invoice')?.buyerGstin ?? '')
    })
  }, [orderId])

  // Helpers
  const reload = async () => setData(await api.gstInvoices.forOrder({ orderId }))
  const run = async (key: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(key)
    try {
      await fn()
      await reload()
      if (done) toast.success(done)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(null)
    }
  }

  // Event handlers
  const handleQueue = () =>
    run('queue', () => api.gstInvoices.queue.add({ orderIds: [orderId] }), copy.queued)
  const handleSlip = (kind: 'packing_slip' | 'order_confirmation') =>
    run(kind, () => api.gstInvoices.issue({ orderId, kind }))
  const handleDownload = (id: string) =>
    run(`dl-${id}`, async () => saveFile(await api.gstInvoices.download({ id })))
  const handleRegenerate = (id: string) =>
    run(`re-${id}`, () => api.gstInvoices.regenerate({ id, buyerGstin: cleanGstin(gstin) }))
  const handleCredit = (refundId: string) =>
    run(`cn-${refundId}`, () => api.gstInvoices.creditNote({ refundId }))

  // Early returns
  if (!data) return null

  // Render logic
  const invoice = data.documents.find((d) => d.kind === 'tax_invoice' && d.status !== 'cancelled')
  const credited = new Set(data.documents.map((d) => d.refundId).filter(Boolean))
  const openRefunds =
    invoice?.status === 'issued' && data.enabled.credit_note
      ? data.refunds.filter((r) => !credited.has(r.id))
      : []
  const buyerGstin = cleanGstin(gstin)
  const gstinBad = buyerGstin !== null && !validateGstin(buyerGstin).ok
  const editable = invoice && (invoice.status === 'draft' || !invoice.reportedPeriod)
  const slips = (['packing_slip', 'order_confirmation'] as const).filter(
    (k) => data.enabled[k] && !data.documents.some((d) => d.kind === k),
  )
  const issued = data.documents.filter((d) => d.status !== 'draft')

  return (
    <DataCard
      title={copy.title}
      action={
        <Link
          href={`${APP}/settings`}
          className="text-caption text-muted-foreground hover:text-foreground"
        >
          {copy.settings}
        </Link>
      }
    >
      <div className="flex flex-col gap-3">
        {issued.length === 0 && !invoice ? (
          <p className="text-body text-muted-foreground">{copy.empty}</p>
        ) : null}
        {invoice?.status === 'draft' ? (
          <div className="flex items-center justify-between gap-3 rounded-[0.5rem] bg-secondary p-2.5">
            <span className="text-body">{copy.statuses.draft}</span>
            <Link href={APP} className="text-caption font-medium hover:underline">
              {copy.openQueue}
            </Link>
          </div>
        ) : null}
        {issued.map((d) => (
          <div
            key={d.id}
            className="flex items-center gap-3 rounded-[0.5rem] border border-border p-2.5"
          >
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <div className="flex min-w-0 flex-1 flex-col">
              <Link
                href={`${APP}/invoices/${d.id}`}
                className="truncate text-body font-medium hover:underline"
              >
                {d.number ?? copy.kinds[d.kind]}
              </Link>
              <span className="text-caption text-muted-foreground">
                {copy.kinds[d.kind]}, {formatDay(d.invoiceDate ?? d.issuedAt)},{' '}
                {formatPaise(d.totalPaise)}
                {d.status === 'cancelled' ? `, ${copy.statuses.cancelled}` : ''}
                {d.pdfStatus === 'failed' ? `, ${copy.pdfFailed}` : ''}
              </span>
            </div>
            {d.kind === 'tax_invoice' && d.status === 'issued' && !d.reportedPeriod ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={copy.regenerate}
                disabled={busy !== null}
                onClick={() => handleRegenerate(d.id)}
              >
                <RefreshCw />
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => handleDownload(d.id)}
            >
              <Download />
              {copy.download}
            </Button>
          </div>
        ))}
        {openRefunds.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3">
            <span className="text-caption text-muted-foreground">
              {copy.refundLabel(formatPaise(r.amountPaise))}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => handleCredit(r.id)}
            >
              {copy.creditNote}
            </Button>
          </div>
        ))}
        {openRefunds.length && invoice?.buyerGstin ? (
          <p className="text-caption text-muted-foreground">{copy.b2bNotice}</p>
        ) : null}
        {editable ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`buyer-gstin-${orderId}`} className="text-caption">
              {copy.buyerGstin}
            </Label>
            <div className="flex gap-2">
              <Input
                id={`buyer-gstin-${orderId}`}
                value={gstin}
                maxLength={15}
                aria-invalid={gstinBad || undefined}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="27AAPFU0939F1ZV"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={busy !== null || gstinBad}
                onClick={() => handleRegenerate(invoice.id)}
              >
                {copy.saveGstin}
              </Button>
            </div>
            <span className="text-caption text-muted-foreground">{copy.buyerGstinHelp}</span>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {!invoice && data.enabled.tax_invoice ? (
            <Button size="sm" disabled={busy !== null} onClick={handleQueue}>
              {copy.queue}
            </Button>
          ) : null}
          {slips.map((k) => (
            <Button
              key={k}
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={() => handleSlip(k)}
            >
              {k === 'packing_slip' ? copy.issueSlip : copy.issueConfirmation}
            </Button>
          ))}
        </div>
      </div>
    </DataCard>
  )
}
