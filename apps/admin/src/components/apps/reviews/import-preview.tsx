'use client'

import { formatNumber } from '@commerce/money'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import { reviewsContent } from '@/data/reviews'
import { useCopy } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'
import ReviewStars from './review-stars'

type Preview = Extract<Awaited<ReturnType<typeof api.reviews.judgeme.preview>>, { ok: true }>
type Options = { copyPhotos: boolean; publish: boolean; unmatchedAsStore: boolean }

type ImportPreviewProps = {
  preview: Preview
  options: Options
  onOptionsChange: (next: Options) => void
  importing: boolean
  onImport: () => void
  onCancel: () => void
}

const RESULT_TONE = {
  sku: 'success',
  product_id: 'success',
  handle: 'success',
  store: 'info',
  none: 'attention',
  imported: 'neutral',
} as const

const COUNT_TONE = {
  ready: 'border-success/30 bg-success-soft',
  store: 'border-success/30 bg-success-soft',
  noMatch: 'border-warning/35 bg-warning-soft',
  photos: 'border-info/30 bg-info-soft',
} as const

/**
 * Step 3: what the file holds, how each review matched, the products it names that are
 * not here, the options and the Import button.
 */
export default function ImportPreview({
  preview,
  options,
  onOptionsChange,
  importing,
  onImport,
  onCancel,
}: ImportPreviewProps) {
  // Hooks
  const all = useCopy(reviewsContent)

  // Render logic
  const copy = all.import.step3
  const counts = [
    { key: 'ready' as const, n: preview.ready, label: copy.ready },
    { key: 'store' as const, n: preview.store, label: copy.store },
    { key: 'noMatch' as const, n: preview.noMatch, label: copy.noMatch },
    { key: 'photos' as const, n: preview.photos, label: copy.photos },
  ]
  const hidden = preview.total - preview.rows.length
  const toImport = preview.ready + preview.store + (options.unmatchedAsStore ? preview.noMatch : 0)

  return (
    <DataCard title={copy.title}>
      <div className="flex flex-col gap-4">
        <p className="text-caption text-muted-foreground">{copy.help}</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {counts.map((c) => (
            <div key={c.key} className={cn('rounded-lg border p-4', COUNT_TONE[c.key])}>
              <p className="text-stat text-ink-strong tabular-nums">{formatNumber(c.n)}</p>
              <p className="text-body text-foreground">{c.label}</p>
            </div>
          ))}
        </div>
        {preview.already > 0 ? (
          <p className="text-caption text-muted-foreground">{copy.already(preview.already)}</p>
        ) : null}
        {preview.skipped > 0 ? (
          <p className="text-caption text-muted-foreground">{copy.skipped(preview.skipped)}</p>
        ) : null}
        {preview.unmatched.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-md border border-warning/35 bg-warning-soft p-3">
            <p className="text-body-strong">{copy.unmatchedTitle}</p>
            <ul className="flex flex-col gap-1 text-body">
              {preview.unmatched.map((u) => (
                <li key={u.product} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-mono text-caption">{u.product}</span>
                  <span className="shrink-0 text-caption text-muted-foreground tabular-nums">
                    {copy.unmatchedRow(u.reviews)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.columns.product}</TableHead>
                <TableHead>{copy.columns.rating}</TableHead>
                <TableHead>{copy.columns.review}</TableHead>
                <TableHead>{copy.columns.reviewer}</TableHead>
                <TableHead>{copy.columns.result}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.rows.map((r) => (
                <TableRow key={r.line}>
                  <TableCell className="max-w-[14rem] truncate">{r.product}</TableCell>
                  <TableCell>
                    <ReviewStars value={r.rating} label={all.stars(r.rating)} />
                  </TableCell>
                  <TableCell className="max-w-[16rem] truncate">{r.title}</TableCell>
                  <TableCell className="max-w-[10rem] truncate">{r.reviewer}</TableCell>
                  <TableCell>
                    <StatusChip tone={RESULT_TONE[r.result]}>{copy.result[r.result]}</StatusChip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {hidden > 0 ? (
          <p className="text-caption text-muted-foreground">{copy.more(hidden)}</p>
        ) : null}
        <div className="flex flex-col gap-3">
          <label htmlFor="import-photos" className="flex items-center gap-2 text-body">
            <Checkbox
              id="import-photos"
              checked={options.copyPhotos}
              onCheckedChange={(v) => onOptionsChange({ ...options, copyPhotos: v === true })}
            />
            {copy.copyPhotos(preview.photos)}
          </label>
          <label htmlFor="import-publish" className="flex items-center gap-2 text-body">
            <Checkbox
              id="import-publish"
              checked={options.publish}
              onCheckedChange={(v) => onOptionsChange({ ...options, publish: v === true })}
            />
            {copy.publish}
          </label>
          {preview.noMatch > 0 ? (
            <label htmlFor="import-as-store" className="flex items-start gap-2 text-body">
              <Checkbox
                id="import-as-store"
                checked={options.unmatchedAsStore}
                onCheckedChange={(v) =>
                  onOptionsChange({ ...options, unmatchedAsStore: v === true })
                }
                className="mt-0.5"
              />
              <span className="flex flex-col">
                {copy.asStore(preview.noMatch)}
                <span className="text-caption text-muted-foreground">{copy.asStoreHelp}</span>
              </span>
            </label>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onCancel} disabled={importing}>
            {copy.cancel}
          </Button>
          <Button onClick={onImport} disabled={importing || toImport === 0}>
            {importing ? <Spinner /> : null}
            {importing ? copy.running : copy.run(toImport)}
          </Button>
        </div>
      </div>
    </DataCard>
  )
}
