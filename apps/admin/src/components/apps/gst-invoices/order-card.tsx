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

const cleanGstin = (v: string) => (v.trim() ? v.trim().toUpperCase() : null)

/** GST documents on the order page: issue, download, regenerate, credit notes for refunds. */
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
  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key)
    try {
      await fn()
      await reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(null)
    }
  }

  // Event handlers
  const handleIssue = (kind: 'tax_invoice' | 'packing_slip' | 'order_confirmation') =>
    run(kind, async () => {
      const r = await api.gstInvoices.issue({ orderId, kind, buyerGstin: cleanGstin(gstin) })
      toast.success(copy.issued(r?.number ?? copy.kinds[kind]))
    })
  const handleDownload = (id: string) =>
    run(`dl-${id}`, async () => saveFile(await api.gstInvoices.download({ id })))
  const handleRegenerate = (id: string) =>
    run(`re-${id}`, () => api.gstInvoices.regenerate({ id, buyerGstin: cleanGstin(gstin) }))
  const handleCredit = (refundId: string) =>
    run(`cn-${refundId}`, () => api.gstInvoices.creditNote({ refundId }))

  // Early returns
  if (!data) return null

  // Render logic
  const invoice = data.documents.find((d) => d.kind === 'tax_invoice')
  const credited = new Set(data.documents.map((d) => d.refundId).filter(Boolean))
  const openRefunds =
    invoice && data.enabled.credit_note ? data.refunds.filter((r) => !credited.has(r.id)) : []
  const buyerGstin = cleanGstin(gstin)
  const gstinBad = buyerGstin !== null && !validateGstin(buyerGstin).ok
  const missing = (['tax_invoice', 'packing_slip', 'order_confirmation'] as const).filter(
    (k) => data.enabled[k] && !data.documents.some((d) => d.kind === k),
  )
  const issueLabel = {
    tax_invoice: copy.issue,
    packing_slip: copy.issueSlip,
    order_confirmation: copy.issueConfirmation,
  }

  return (
    <DataCard
      title={copy.title}
      action={
        <Link
          href="/settings/apps/gst-invoices"
          className="text-caption text-muted-foreground hover:text-foreground"
        >
          {copy.settings}
        </Link>
      }
    >
      <div className="flex flex-col gap-3">
        {data.documents.length === 0 ? (
          <p className="text-body text-muted-foreground">{copy.empty}</p>
        ) : null}
        {data.documents.map((d) => (
          <div
            key={d.id}
            className="flex items-center gap-3 rounded-[0.5rem] border border-border p-2.5"
          >
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body font-medium">
                {d.number ?? copy.kinds[d.kind]}
              </span>
              <span className="text-caption text-muted-foreground">
                {copy.kinds[d.kind]}, {formatDay(d.issuedAt)}, {formatPaise(d.totalPaise)}
                {d.pdfStatus === 'failed' ? `, ${copy.pdfFailed}` : ''}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={copy.regenerate}
              disabled={busy !== null}
              onClick={() => handleRegenerate(d.id)}
            >
              <RefreshCw />
            </Button>
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
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`buyer-gstin-${orderId}`} className="text-caption">
            {copy.buyerGstin}
          </Label>
          <Input
            id={`buyer-gstin-${orderId}`}
            value={gstin}
            maxLength={15}
            aria-invalid={gstinBad || undefined}
            onChange={(e) => setGstin(e.target.value.toUpperCase())}
            placeholder="27AAPFU0939F1ZV"
          />
          <span className="text-caption text-muted-foreground">{copy.buyerGstinHelp}</span>
        </div>
        {missing.length ? (
          <div className="flex flex-wrap gap-2">
            {missing.map((k) => (
              <Button
                key={k}
                size="sm"
                variant={k === 'tax_invoice' ? 'default' : 'outline'}
                disabled={busy !== null || gstinBad}
                onClick={() => handleIssue(k)}
              >
                {issueLabel[k]}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </DataCard>
  )
}
