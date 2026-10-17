'use client'

import { Download } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import StatusChip from '@/components/layout/status-chip'
import { storeDataContent } from '@/data/store-data'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'

type Overview = Awaited<ReturnType<typeof api.storeData.overview>>
type ExportRow = Overview['exports'][number]

type StoreExportListProps = {
  exports: ExportRow[]
  downloadingId: string | null
  onDownload: (id: string) => void
}

type BadgeVariant = 'neutral' | 'info' | 'success' | 'danger'

/** Ready-but-expired reads as its own state; the API marks it not downloadable. */
function stateOf(row: ExportRow): keyof typeof storeDataContent.export.status {
  if (row.status === 'ready' && !row.downloadable) return 'expired'
  return row.status
}

const VARIANT: Record<keyof typeof storeDataContent.export.status, BadgeVariant> = {
  queued: 'neutral',
  running: 'info',
  ready: 'success',
  failed: 'danger',
  expired: 'neutral',
}

/** Sizes as people say them: 820 KB, 4.2 MB. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** The store's latest full exports, newest first, each with its state and a download button. */
export default function StoreExportList({
  exports,
  downloadingId,
  onDownload,
}: StoreExportListProps) {
  // Hooks
  const content = useCopy(storeDataContent)
  const format = useFormat()

  // Early returns
  if (exports.length === 0) {
    return <p className="text-body text-muted-foreground">{content.export.none}</p>
  }

  // Render logic
  const copy = content.export

  return (
    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
      {exports.map((row) => {
        const state = stateOf(row)
        const detail =
          row.status === 'ready' && row.rowCount !== null && row.sizeBytes !== null
            ? copy.summary(format.number(row.rowCount), formatBytes(row.sizeBytes))
            : row.status === 'failed'
              ? (row.error ?? '')
              : row.requestedByEmail
                ? copy.requestedBy(row.requestedByEmail)
                : ''
        return (
          <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-body font-medium text-foreground">
                {format.dateTime(row.createdAt)}
              </p>
              {detail ? (
                <p className="truncate text-caption text-muted-foreground">{detail}</p>
              ) : null}
            </div>
            <StatusChip tone={VARIANT[state]}>{copy.status[state]}</StatusChip>
            {row.downloadable ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDownload(row.id)}
                disabled={downloadingId === row.id}
              >
                <Download aria-hidden="true" />
                {copy.download}
              </Button>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
