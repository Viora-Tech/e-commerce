'use client'

import { Printer } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { shipmentsContent } from '@/data/shipments'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import CourierCompareTable from './courier-compare-table'

type CompareRows = Awaited<ReturnType<typeof api.shipments.compareRates>>
type BookResult = Awaited<ReturnType<typeof api.shipments.bulkBook>>

type BookDialogProps = {
  /** The orders to book; the dialog is open while there are any. */
  orderIds: string[]
  onClose: () => void
  /** After a booking, so the page reloads its tabs and clears the selection. */
  onBooked: () => void
}

/**
 * "Book selected": the courier rates for each order (only when more than one courier could
 * take it, so a one-courier store just confirms), a per-order courier choice, then the result
 * with Print labels.
 */
export default function BookDialog({ orderIds, onClose, onBooked }: BookDialogProps) {
  // Hooks
  const copy = useCopy(shipmentsContent.bookDialog)
  const [rows, setRows] = useState<CompareRows | null>(null)
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<BookResult | null>(null)
  // Fresh rates each time the dialog opens for a new set of orders.
  useEffect(() => {
    if (orderIds.length === 0) return
    let live = true
    setRows(null)
    setOverrides({})
    setResult(null)
    api.shipments
      .compareRates({ orderIds })
      .then((r) => live && setRows(r))
      .catch((err: unknown) => {
        if (!live) return
        toast.error(err instanceof Error ? err.message : String(err))
        setRows([])
      })
    return () => {
      live = false
    }
  }, [orderIds])

  // Event handlers
  const handleOverride = (orderId: string, providerId: string) =>
    setOverrides((prev) => {
      const next = { ...prev }
      if (providerId) next[orderId] = providerId
      else delete next[orderId]
      return next
    })
  const handleBook = async () => {
    setBusy(true)
    try {
      const r = await api.shipments.bulkBook({
        orderIds,
        courierOverrides: Object.keys(overrides).length > 0 ? overrides : undefined,
      })
      setResult(r)
      onBooked()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }
  const handlePrint = () => {
    for (const r of result ?? []) {
      if (r.ok && r.labelUrl) window.open(r.labelUrl, '_blank', 'noopener')
    }
  }

  // Render logic
  const choosing = rows?.some((r) => r.options.length > 1) ?? false
  const ok = result?.filter((r) => r.ok).length ?? 0
  const failed = (result?.length ?? 0) - ok

  return (
    <Dialog open={orderIds.length > 0} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={choosing && !result ? 'sm:max-w-3xl' : undefined}>
        <DialogHeader>
          <DialogTitle>{copy.title(orderIds.length)}</DialogTitle>
          <DialogDescription>
            {result ? copy.done(ok) : rows === null ? copy.checking : copy.body}
          </DialogDescription>
        </DialogHeader>
        {result && failed > 0 ? (
          <ul className="flex flex-col gap-1 text-caption text-danger">
            <li className="font-medium">{copy.failed(failed)}</li>
            {result
              .filter((r) => !r.ok)
              .map((r) => (
                <li key={r.orderId}>{r.error}</li>
              ))}
          </ul>
        ) : null}
        {!result && choosing && rows ? (
          <CourierCompareTable
            rows={rows}
            overrides={overrides}
            onOverrideChange={handleOverride}
          />
        ) : null}
        <DialogFooter>
          {result ? (
            <>
              {ok > 0 ? (
                <Button variant="outline" onClick={handlePrint}>
                  <Printer aria-hidden />
                  {shipmentsContent.printLabels}
                </Button>
              ) : null}
              <Button onClick={onClose}>{copy.close}</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                {copy.cancel}
              </Button>
              <Button onClick={handleBook} disabled={busy || rows === null}>
                {busy ? <Spinner /> : null}
                {busy ? copy.booking : copy.confirm(orderIds.length)}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
