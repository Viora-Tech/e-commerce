'use client'

import { Download, Printer, RefreshCw, Save } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { toast } from 'sonner'
import type { AppPageProps } from '@/apps/registry'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import CopyButton from '@/components/fields/copy-button'
import DateField from '@/components/fields/date-field'
import BackLink from '@/components/layout/back-link'
import DataCard from '@/components/layout/data-card'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import PageHeader from '@/components/layout/page-header'
import PageHeaderSkeleton from '@/components/layout/page-header-skeleton'
import StatusLabel from '@/components/status/status-label'
import { appsContent } from '@/data/apps'
import { gstAlreadyInvoicedContent } from '@/data/gst-already-invoiced'
import { gstInvoiceRefreshContent as refreshCopy } from '@/data/gst-invoice-refresh'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { formatDay } from '@/lib/format-date'
import { formatPaise } from '@/lib/money'
import { routes } from '@/lib/routes'
import InvoiceLinesCard from './invoice-lines-card'
import { saveFile } from './save-file'
import TextField from './text-field'
import UndoRecordedCard from './undo-recorded-card'

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
  const apps = useCopy(appsContent)
  const outsideCopy = useCopy(gstAlreadyInvoicedContent)
  const [ship, setShip] = useState<Shipping | null>(null)
  const {
    data: doc,
    failed,
    retry,
    setData: setDoc,
  } = useLoad(async () => {
    const d = await api.gstInvoices.get({ id: params.id ?? '' })
    setShip(shippingOf(d))
    return d
  }, [params.id])
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  // Helpers
  const run = async (action: string, fn: () => Promise<void>, done?: string) => {
    setBusy(action)
    try {
      await fn()
      const d = await api.gstInvoices.get({ id: params.id ?? '' })
      setDoc(d)
      if (done) toast.success(done)
    } catch (err) {
      toast.error(errorText(err, copy.cancel))
    } finally {
      setBusy(null)
    }
  }

  const setShipField = (k: keyof Shipping) => (v: string) =>
    setShip((cur) => (cur ? { ...cur, [k]: v } : cur))

  // Event handlers
  const handleDownload = () =>
    run('download', async () => saveFile(await api.gstInvoices.download({ id: params.id ?? '' })))
  // Opens the PDF in a new tab, where the browser's viewer prints it (as the list's bulk Print does).
  const handlePrint = () =>
    run('print', async () =>
      saveFile(await api.gstInvoices.download({ id: params.id ?? '' }), 'open'),
    )
  const handleCancel = () =>
    run(
      'cancel',
      async () => {
        await api.gstInvoices.cancel({ id: params.id ?? '', reason })
      },
      copy.cancelled,
    )
  const handleRefreshGst = () =>
    run('refresh', async () => {
      const r = await api.gstInvoices.refreshGst({ id: params.id ?? '' })
      toast.success(refreshCopy.done(r.changedLines))
    })
  const handleShipping = () =>
    run(
      'shipping',
      async () => {
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
      },
      copy.saved,
    )

  // Early returns
  if (failed) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href={routes.apps.page('gst-invoices', 'invoices')} label={copy.back} />
        <LoadFailedState
          size="page"
          heading={apps.couldNotLoad.invoice}
          failed={failed}
          onRetry={retry}
        />
      </div>
    )
  }
  if (!doc || !ship) {
    // The page's frame: back link, title with Print and Download, the buyer and lines cards.
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <PageHeaderSkeleton back actions={2} />
        <DataCardSkeleton fields={0} lines={3} />
        <DataCardSkeleton fields={0} lines={4} />
      </div>
    )
  }

  // Render logic
  const s = doc.snapshot
  /** Recorded, invoiced outside Koomerce: no PDF to print or download. */
  const outside = doc.source === 'external'
  const cancellable = doc.kind === 'tax_invoice' && doc.status === 'issued' && !doc.reportedPeriod
  /** "Already invoiced" can be undone until the month is filed (the server checks it too). */
  const undoable = outside && cancellable
  const facts = [
    { label: copy.fields.number, value: doc.number ?? '-' },
    { label: copy.fields.series, value: doc.seriesId ?? '-' },
    { label: copy.fields.date, value: doc.invoiceDate ? formatDay(doc.invoiceDate) : '-' },
    { label: copy.fields.order, value: s.order.name },
    { label: copy.fields.total, value: formatPaise(s.totals.totalPaise) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`${kinds[doc.kind]} ${doc.number ?? ''}`.trim()}
        back={{ label: copy.back, href: routes.apps.page('gst-invoices', 'invoices') }}
        badges={<StatusLabel kind="gstDoc" value={doc.status} variant="soft" />}
        summary={
          doc.number ? (
            <span className="group/row flex items-center gap-1">
              {doc.number}
              <CopyButton value={doc.number} what={copy.fields.number} />
            </span>
          ) : undefined
        }
        actions={
          outside ? (
            <span className="text-body text-muted-foreground">{outsideCopy.outside}</span>
          ) : (
            <>
              <Button
                variant="outline"
                disabled={busy !== null}
                onClick={handlePrint}
                loading={busy === 'print'}
              >
                <Printer />
                {copy.print}
              </Button>
              <Button
                variant="outline"
                disabled={busy !== null}
                onClick={handleDownload}
                loading={busy === 'download'}
              >
                <Download />
                {copy.download}
              </Button>
            </>
          )
        }
      />
      <DataCard bodyClassName="flex flex-col" title={s.buyer.name}>
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
        {outside ? (
          <p className="mt-3 text-caption text-muted-foreground">{outsideCopy.outsideBody}</p>
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
      <InvoiceLinesCard snapshot={s} />
      {s.exportSupply && doc.status !== 'cancelled' && !doc.reportedPeriod ? (
        <DataCard bodyClassName="flex flex-col" title={copy.shipping}>
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
              <FieldLabel htmlFor="exp-date">{copy.billDate}</FieldLabel>
              <DateField
                id="exp-date"
                value={ship.shippingBillDate}
                onChange={(v) => setShipField('shippingBillDate')(v)}
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
          <Button
            className="mt-3 self-end"
            variant="outline"
            disabled={busy !== null}
            onClick={handleShipping}
            loading={busy === 'shipping'}
          >
            <Save aria-hidden="true" />
            {copy.saveShipping}
          </Button>
        </DataCard>
      ) : null}
      {undoable ? (
        <UndoRecordedCard invoiceId={doc.id} number={doc.number ?? ''} disabled={busy !== null} />
      ) : null}
      {cancellable ? (
        <DataCard bodyClassName="flex flex-col" title={refreshCopy.title}>
          <p className="text-body text-muted-foreground">{refreshCopy.body}</p>
          <Button
            className="mt-3 self-start"
            variant="outline"
            disabled={busy !== null}
            onClick={handleRefreshGst}
            loading={busy === 'refresh'}
          >
            <RefreshCw aria-hidden="true" />
            {refreshCopy.button}
          </Button>
        </DataCard>
      ) : null}
      {cancellable ? (
        <DataCard bodyClassName="flex flex-col" title={copy.cancel}>
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
              disabled={busy !== null || reason.trim().length < 3}
              onClick={handleCancel}
              loading={busy === 'cancel'}
            >
              {copy.cancel}
            </Button>
          </div>
        </DataCard>
      ) : null}
    </div>
  )
}
