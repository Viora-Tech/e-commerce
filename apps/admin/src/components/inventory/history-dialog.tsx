'use client'

import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import DialogContent from '@/components/layout/dialog-content'
import DialogHeader from '@/components/layout/dialog-header'
import EmptyState from '@/components/layout/empty-state'
import RelativeTime from '@/components/layout/relative-time'
import { inventoryContent, REASON_LABELS } from '@/data/inventory'
import { useCopy } from '@/hooks/use-copy'
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

/** Every stock change for one SKU at the selected location, newest first. */
export default function HistoryDialog({
  variantId,
  name,
  sku,
  locationId,
  onClose,
}: HistoryDialogProps) {
  // Hooks
  const { history: copy } = useCopy(inventoryContent)
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {name}
            {sku ? ` (${sku})` : ''}
          </DialogDescription>
        </DialogHeader>
        <div>
          {rows === null ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-4/5" />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState variant="inline" body={copy.empty} />
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
                  <span className="text-caption text-muted-foreground">
                    <RelativeTime value={row.createdAt} /> ·{' '}
                    {row.actorName ? copy.by(row.actorName) : copy.bySystem}
                  </span>
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
