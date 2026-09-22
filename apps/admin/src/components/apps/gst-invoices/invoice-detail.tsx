'use client'

import { ArrowLeft, Download } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { AppPageProps } from '@/apps/registry'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { api } from '@/lib/api-client'
import { formatDay } from '@/lib/format-date'
import { formatPaise } from '@/lib/money'
import { saveFile } from './save-file'
import TextField from './text-field'

type Doc = Awaited<ReturnType<typeof api.gstInvoices.get>>

type Shipping = {
  portCode: string
  shippingBillNumber: string
  shippingBillDate: string
  currency: string
  exchangeRate: string
}

const copy = gstInvoicesContent.detail
const kinds = gstInvoicesContent.kinds
const statuses = gstInvoicesContent.statuses

const shippingOf = (doc: Doc): Shipping => ({
  portCode: doc.snapshot.exportSupply?.portCode ?? '',
  shippingBillNumber: doc.snapshot.exportSupply?.shippingBillNumber ?? '',
  shippingBillDate: doc.snapshot.exportSupply?.shippingBillDate ?? '',
  currency: doc.snapshot.exportSupply?.currency ?? '',
  exchangeRate: doc.snapshot.exportSupply?.exchangeRate?.toString() ?? '',
})

/** One issued document: its facts, the PDF, export details and cancellation. */
export default function InvoiceDetail({ params }: AppPageProps) {
  // Hooks
  const [doc, setDoc] = useState<Doc | null>(null)
  const [reason, setReason] = useState('')
  const [ship, setShip] = useState<Shipping | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.gstInvoices.get({ id: params.id ?? '' }).then((d) => {
      setDoc(d)
      setShip(shippingOf(d))
    })
  }, [params.id])

  // Helpers
  const run = async (fn: () => Promise<void>, done?: string) => {
    setBusy(true)
    try {
      await fn()
      const d = await api.gstInvoices.get({ id: params.id ?? '' })
      setDoc(d)
      if (done) toast.success(done)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.cancel)
    } finally {
      setBusy(false)
    }
  }

  const setShipField = (k: keyof Shipping) => (v: string) =>
    setShip((cur) => (cur ? { ...cur, [k]: v } : cur))

  // Event handlers
  const handleDownload = () =>
    run(async () => saveFile(await api.gstInvoices.download({ id: params.id ?? '' })))
  const handleCancel = () =>
    run(async () => {
      await api.gstInvoices.cancel({ id: params.id ?? '', reason })
    }, copy.cancelled)
  const handleShipping = () =>
    run(async () => {
      if (!ship) return
      await api.gstInvoices.regenerate({
        id: params.id ?? '',
        exportDetails: {
          portCode: ship.portCode || null,
          shippingBillNumber: ship.shippingBillNumber || null,
          shippingBillDate: ship.shippingBillDate || null,
          currency: ship.currency ? ship.currency.toUpperCase() : null,
          exchangeRate: ship.exchangeRate ? Number(ship.exchangeRate) : null,
        },
      })
    }, copy.saved)

  // Early returns
  if (!doc || !ship) return null

  // Render logic
  const s = doc.snapshot
  const cancellable = doc.kind === 'tax_invoice' && doc.status === 'issued' && !doc.reportedPeriod
  const facts = [
    { label: copy.fields.number, value: doc.number ?? '-' },
    { label: copy.fields.series, value: doc.seriesId ?? '-' },
    { label: copy.fields.date, value: doc.invoiceDate ? formatDay(doc.invoiceDate) : '-' },
    { label: copy.fields.order, value: s.order.name },
    { label: copy.fields.status, value: statuses[doc.status] },
    { label: copy.fields.total, value: formatPaise(s.totals.totalPaise) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`${kinds[doc.kind]} ${doc.number ?? ''}`.trim()}
        actions={
          <>
            <Button variant="ghost" render={<Link href="/apps/gst-invoices/invoices" />}>
              <ArrowLeft />
              {copy.back}
            </Button>
            <Button variant="outline" disabled={busy} onClick={handleDownload}>
              <Download />
              {copy.download}
            </Button>
          </>
        }
      />
      <DataCard title={s.buyer.name}>
        <dl className="grid gap-3 sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.label} className="flex flex-col gap-0.5">
              <dt className="text-caption text-muted-foreground">{f.label}</dt>
              <dd className="text-body">{f.value}</dd>
            </div>
          ))}
        </dl>
        {s.exportSupply ? (
          <p className="mt-3 text-caption font-medium">{s.exportSupply.endorsement}</p>
        ) : null}
        {doc.reportedPeriod ? (
          <p className="mt-3 text-caption text-muted-foreground">
            {copy.reported(doc.reportedPeriod)}
          </p>
        ) : null}
        {doc.reportedPeriod && s.buyer.gstin ? (
          <p className="mt-1 text-caption text-muted-foreground">{copy.b2bCreditNotice}</p>
        ) : null}
      </DataCard>
      {s.exportSupply && doc.status !== 'cancelled' && !doc.reportedPeriod ? (
        <DataCard title={copy.shipping}>
          <div className="grid gap-3 md:grid-cols-3">
            <TextField
              id="exp-port"
              label={copy.port}
              value={ship.portCode}
              maxLength={10}
              onChange={setShipField('portCode')}
            />
            <TextField
              id="exp-bill"
              label={copy.billNo}
              value={ship.shippingBillNumber}
              maxLength={20}
              onChange={setShipField('shippingBillNumber')}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="exp-date" className="text-body font-medium">
                {copy.billDate}
              </label>
              <Input
                id="exp-date"
                size="lg"
                type="date"
                value={ship.shippingBillDate}
                onChange={(e) => setShipField('shippingBillDate')(e.target.value)}
              />
            </div>
            <TextField
              id="exp-cur"
              label={copy.currency}
              value={ship.currency}
              maxLength={3}
              onChange={setShipField('currency')}
            />
            <TextField
              id="exp-rate"
              label={copy.rate}
              value={ship.exchangeRate}
              inputMode="numeric"
              maxLength={10}
              onChange={setShipField('exchangeRate')}
            />
          </div>
          <Button className="mt-3" variant="outline" disabled={busy} onClick={handleShipping}>
            {copy.saveShipping}
          </Button>
        </DataCard>
      ) : null}
      {cancellable ? (
        <DataCard title={copy.cancel}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              size="lg"
              aria-label={copy.cancelReason}
              placeholder={copy.cancelReason}
              value={reason}
              maxLength={200}
              onChange={(e) => setReason(e.target.value)}
            />
            <Button
              variant="destructive"
              disabled={busy || reason.trim().length < 3}
              onClick={handleCancel}
            >
              {copy.cancel}
            </Button>
          </div>
        </DataCard>
      ) : null}
    </div>
  )
}
