'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import RelativeTime from '@/components/layout/relative-time'
import { inventoryContent, REASON_LABELS } from '@/data/inventory'
import { api } from '@/lib/api-client'

type Entry = Awaited<ReturnType<typeof api.inventory.history>>[number]

type HistoryDialogProps = {
  /** The variant whose log is open; null closes the dialog. */
  variantId: string | null
  name: string
  sku: string | null
  locationId: string
  onClose: () => void
}

const copy = inventoryContent.history

/** Every stock change for one SKU at the selected location, newest first. */
export default function HistoryDialog({
  variantId,
  name,
  sku,
  locationId,
  onClose,
}: HistoryDialogProps) {
  // Hooks
  const [rows, setRows] = useState<Entry[] | null>(null)

  useEffect(() => {
    if (!variantId) return
    let cancelled = false
    setRows(null)
    api.inventory
      .history({ variantId, locationId })
      .then((r) => !cancelled && setRows(r))
      .catch(() => !cancelled && setRows([]))
    return () => {
      cancelled = true
    }
  }, [variantId, locationId])

  // Render logic
  return (
    <Dialog open={variantId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-md">
        <DialogHeader className="gap-0.5 p-4 pr-12 border-line border-b">
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {name}
            {sku ? ` (${sku})` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {rows === null ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-4/5" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-body text-muted-foreground">{copy.empty}</p>
          ) : (
            <ul className="flex flex-col">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-border-soft border-b py-3 last:border-b-0"
                >
                  <span className="text-body-strong">
                    {REASON_LABELS[row.reason] ?? row.reason}
                  </span>
                  <span
                    className={
                      row.delta > 0
                        ? 'text-body-strong text-success tabular-nums'
                        : 'text-body-strong text-destructive tabular-nums'
                    }
                  >
                    {row.delta > 0 ? `+${row.delta}` : row.delta}
                  </span>
                  <RelativeTime
                    value={row.createdAt}
                    className="text-caption text-muted-foreground"
                  />
                  {row.note ? (
                    <span className="col-span-2 text-caption text-muted-foreground">
                      {row.note}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
