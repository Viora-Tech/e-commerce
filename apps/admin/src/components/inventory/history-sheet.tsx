'use client'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@commerce/ui/shadcn/sheet'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import { inventoryContent, REASON_LABELS } from '@/data/inventory'
import { api } from '@/lib/api-client'

type Entry = Awaited<ReturnType<typeof api.inventory.history>>[number]

type HistorySheetProps = {
  /** The variant whose log is open; null closes the sheet. */
  variantId: string | null
  name: string
  sku: string | null
  locationId: string
  onClose: () => void
}

const copy = inventoryContent.history

const when = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/** Every stock change for one SKU at the selected location, newest first. */
export default function HistorySheet({
  variantId,
  name,
  sku,
  locationId,
  onClose,
}: HistorySheetProps) {
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
    <Sheet open={variantId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="border-line border-b">
          <SheetTitle>{copy.title}</SheetTitle>
          <SheetDescription>
            {name}
            {sku ? ` (${sku})` : ''}
          </SheetDescription>
        </SheetHeader>
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
                  <span className="text-caption text-muted-foreground">
                    {when.format(new Date(row.createdAt))}
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
      </SheetContent>
    </Sheet>
  )
}
