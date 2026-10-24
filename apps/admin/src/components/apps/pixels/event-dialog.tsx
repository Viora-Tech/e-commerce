'use client'

import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import type { LogRow } from '@/components/apps/pixels/log-columns'
import { matchedText } from '@/components/apps/pixels/log-columns'
import RelativeTime from '@/components/layout/relative-time'
import { pixelsContent } from '@/data/pixels'
import { useCopy } from '@/hooks/use-copy'

type EventDialogProps = {
  row: LogRow | null
  pixelName: string
  onClose: () => void
}

/** One event: its id, Meta's answer, fbtrace id, attempts and which details matched. */
export default function EventDialog({ row, pixelName, onClose }: EventDialogProps) {
  // Hooks
  const copy = useCopy(pixelsContent)

  // Render logic
  const l = copy.log
  const items: [string, React.ReactNode][] = row
    ? [
        [l.columns.event, copy.events[row.eventName] ?? row.eventName],
        [l.columns.pixel, pixelName],
        [
          l.eventId,
          <code key="id" className="break-all text-caption">
            {row.eventId}
          </code>,
        ],
        [l.columns.status, l.statuses[row.status] ?? row.status],
        [
          l.response,
          row.error ??
            (row.skipReason ? (l.skipReasons[row.skipReason] ?? row.skipReason) : null) ??
            (row.httpStatus ? `HTTP ${row.httpStatus}` : l.none),
        ],
        [l.trace, row.fbtraceId ?? l.none],
        [l.attempts, String(row.attempts)],
        [l.sentAt, row.sentAt ? <RelativeTime key="sent" value={row.sentAt} /> : l.none],
        [l.columns.matched, matchedText(copy, row.matched as Record<string, boolean>) || l.none],
      ]
    : []

  return (
    <Dialog open={row !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{l.detailTitle}</DialogTitle>
        </DialogHeader>
        <dl className="grid grid-cols-[minmax(0,10rem)_1fr] gap-x-4 gap-y-2 text-body">
          {items.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="min-w-0">{value}</dd>
            </div>
          ))}
        </dl>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {l.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
