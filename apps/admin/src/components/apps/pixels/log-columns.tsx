import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import RelativeTime from '@/components/layout/relative-time'
import StatusChip from '@/components/layout/status-chip'
import type { ChipTone } from '@/components/status/tone'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { pixelsContent } from '@/data/pixels'
import type { api } from '@/lib/api-client'
import type { Formatters } from '@/lib/format'
import { routes } from '@/lib/routes'

export type LogRow = Awaited<ReturnType<typeof api.pixels.log.list>>['rows'][number]

const TONE: Record<string, ChipTone> = {
  queued: 'attention',
  sent: 'success',
  failed: 'danger',
  skipped: 'neutral',
}

/** Which details matched, in words ("Email · Phone · fbp"). */
export function matchedText(copy: typeof pixelsContent, matched: Record<string, boolean>): string {
  return Object.entries(matched)
    .filter(([, on]) => on)
    .map(([key]) => copy.log.matched[key] ?? key)
    .join(' · ')
}

/** Columns of the Pixels event log. */
export function logColumns(
  copy: typeof pixelsContent,
  f: Formatters,
  pixelNames: Map<string, string>,
  onOpen: (row: LogRow) => void,
): ResourceColumnSpec<LogRow>[] {
  const c = copy.log.columns
  return [
    {
      id: 'time',
      title: c.time,
      align: 'start',
      hideable: false,
      render: (r) => (
        <Button variant="link" className="h-auto p-0" onClick={() => onOpen(r)}>
          <RelativeTime value={r.createdAt} />
        </Button>
      ),
    },
    { id: 'event', title: c.event, render: (r) => copy.events[r.eventName] ?? r.eventName },
    { id: 'pixel', title: c.pixel, render: (r) => pixelNames.get(r.connectionId) ?? '' },
    { id: 'origin', title: c.origin, render: (r) => copy.log.origins[r.origin] ?? r.origin },
    {
      id: 'status',
      title: c.status,
      render: (r) => (
        <span className="flex flex-col items-start gap-1">
          <StatusChip tone={TONE[r.status] ?? 'neutral'}>
            {copy.log.statuses[r.status] ?? r.status}
          </StatusChip>
          {r.skipReason ? (
            <span className="text-caption text-muted-foreground">
              {copy.log.skipReasons[r.skipReason] ?? r.skipReason}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'matched',
      title: c.matched,
      render: (r) => matchedText(copy, r.matched as Record<string, boolean>) || copy.log.none,
    },
    {
      id: 'value',
      title: c.value,
      align: 'end',
      render: (r) => (r.valuePaise == null ? copy.log.none : f.money(r.valuePaise)),
    },
    {
      id: 'order',
      title: c.order,
      render: (r) =>
        r.orderId ? (
          <Link className="hover:underline" href={routes.orders.detail(r.orderId)}>
            {copy.log.columns.order}
          </Link>
        ) : (
          copy.log.none
        ),
    },
  ]
}
