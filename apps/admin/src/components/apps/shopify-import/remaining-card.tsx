'use client'

import type {
  ImportResource,
  ImportStatus,
  ResourceStatus,
} from '@commerce/plugin-shopify-import/client'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import StatusLabel from '@/components/status/status-label'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type RemainingCardProps = {
  /** Connected to Shopify; without it the counts are only what earlier previews saw. */
  connected: boolean
}

/** One table row: a resource, or product images on their own line. */
type Row = {
  key: string
  label: string
  inShopify: number | null
  /** Where Shopify's number came from when Shopify could not count it live. */
  countedFrom: 'preview' | 'import' | null
  countedAt: string | null
  here: number | null
  state: ResourceStatus['state']
  missing: number
  /** What its button starts ("Import remaining" for just this). */
  resources: ImportResource[] | null
  action: 'import' | 'images' | 'files' | 'preview' | null
}

const base = shopifyImportContent.base
const ROWS_LOADING = 6

function actionOf(r: ResourceStatus): Row['action'] {
  // Shopify's number is not known: a preview counts it (never "Done" without one).
  if (r.state === 'unknown') return 'preview'
  if (r.missing === 0) return null
  if (r.state === 'not_copied') return 'files'
  return r.state === 'missing' || r.state === 'never' ? 'import' : null
}

function rowsOf(status: ImportStatus, labels: Record<ImportResource, string>, images: string) {
  const rows: Row[] = []
  for (const r of status.resources) {
    rows.push({
      key: r.resource,
      label: labels[r.resource],
      inShopify: r.inShopify,
      countedFrom: r.countedFrom === 'shopify' ? null : r.countedFrom,
      countedAt: r.countedFrom === 'shopify' ? null : r.countedAt,
      here: r.state === 'unknown' ? null : r.imported,
      state: r.state,
      missing: r.missing,
      resources: [r.resource],
      action: actionOf(r),
    })
    if (r.resource === 'products') {
      // Always shown: unknown reads "Not checked yet", never a silent gap.
      const img = status.images
      rows.push({
        key: 'images',
        label: images,
        inShopify: img.expected,
        countedFrom: img.countedFrom,
        countedAt: img.countedAt,
        here: img.here,
        state: img.state,
        missing: img.missing,
        resources: ['products'],
        action: img.missing > 0 ? 'images' : img.state === 'unknown' ? 'preview' : null,
      })
    }
  }
  return rows
}

/**
 * "What's left to import": per type, Shopify's count next to what is here and
 * what is missing, with a button for each and one "Import remaining" for all.
 */
export default function RemainingCard({ connected }: RemainingCardProps) {
  // Hooks
  const copy = useCopy(shopifyImportContent.remaining)
  const labels = useCopy(shopifyImportContent.resources)
  const fmt = useFormat()
  const router = useRouter()
  const [status, setStatus] = useState<ImportStatus | null | undefined>(undefined)
  const [busy, setBusy] = useState<string | null>(null)

  // Counted once per page load; the server also caches Shopify's counts for a few minutes.
  useEffect(() => {
    let live = true
    api.shopifyImport
      .status()
      .then((next) => {
        if (live) setStatus(next)
      })
      .catch(() => {
        if (live) setStatus(null)
      })
    return () => {
      live = false
    }
  }, [])

  // Helpers
  const number = (n: number | null) => (n === null ? '—' : fmt.number(n))
  const stateText = (row: Row) =>
    row.state === 'missing'
      ? copy.missingCount(row.missing)
      : row.state === 'not_copied'
        ? copy.notCopiedCount(row.missing)
        : copy.state[row.state]
  const actionLabel = (row: Row) =>
    row.action === 'import'
      ? copy.action.import(row.missing)
      : row.action
        ? copy.action[row.action]
        : ''
  const countedText = (row: Row) =>
    row.countedFrom === 'preview' && row.countedAt
      ? copy.fromPreview(fmt.date(row.countedAt))
      : row.countedFrom === 'import' && row.countedAt
        ? copy.fromImport(fmt.date(row.countedAt))
        : row.countedFrom === 'import'
          ? copy.fromIssues
          : copy.fromShopify

  // Event handlers
  const handleStart = async (key: string, resources: ImportResource[], action?: Row['action']) => {
    if (action === 'preview') {
      router.push(`${base}/connect`)
      return
    }
    setBusy(key)
    try {
      const run = await api.shopifyImport.importRemaining({ resources })
      toast.success(copy.started)
      router.push(`${base}/runs/${run.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.startFailed)
      setBusy(null)
    }
  }

  // Early returns
  if (status === null) {
    return (
      <DataCard title={copy.heading}>
        <p className="text-body text-muted-foreground">{copy.loadFailed}</p>
      </DataCard>
    )
  }

  // Render logic
  const rows = status ? rowsOf(status, labels, copy.images) : []
  const remaining = status?.remaining ?? []
  const previewAt = rows.find((r) => r.countedFrom === 'preview' && r.countedAt)?.countedAt ?? null
  const facts = [
    status?.lastImportAt ? copy.lastImport(fmt.when(status.lastImportAt)) : copy.nothingYet,
    status?.freshPreview ? copy.previewReused(fmt.when(status.freshPreview.takenAt)) : null,
    previewAt ? copy.fromPreview(fmt.date(previewAt)) : null,
    connected || previewAt ? null : copy.notConnected,
  ].filter((f): f is string => Boolean(f))

  return (
    <DataCard
      title={copy.heading}
      flush
      action={
        <Button
          type="button"
          onClick={() => handleStart('all', remaining)}
          disabled={!status || remaining.length === 0 || busy !== null}
        >
          {busy === 'all' ? <Spinner /> : null}
          {status && remaining.length === 0 ? copy.allHere : copy.importRemaining}
        </Button>
      }
    >
      <div className="mb-3 flex flex-col gap-1.5 px-5 in-data-[layout=sections]:px-4 md:in-data-[layout=sections]:px-6">
        <p className="text-body text-muted-foreground">{copy.subtitle}</p>
        <ul className="flex flex-col gap-0.5 text-caption text-muted-foreground">
          {facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{copy.columns.what}</TableHead>
            <TableHead className="hidden text-right sm:table-cell">
              {copy.columns.inShopify}
            </TableHead>
            <TableHead className="hidden text-right sm:table-cell">{copy.columns.here}</TableHead>
            <TableHead>{copy.columns.status}</TableHead>
            <TableHead className="hidden w-0 sm:table-cell" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {status === undefined
            ? Array.from({ length: ROWS_LOADING }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            : rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className={row.key === 'images' ? 'pl-6' : undefined}>
                    <span
                      className={
                        row.key === 'images'
                          ? 'text-muted-foreground'
                          : 'font-medium text-ink-strong'
                      }
                    >
                      {row.label}
                    </span>
                    <span className="block text-caption text-muted-foreground tabular-nums sm:hidden">
                      {number(row.here)} / {number(row.inShopify)}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    <span title={countedText(row)}>{number(row.inShopify)}</span>
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {number(row.here)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <StatusLabel kind="importState" value={row.state} label={stateText(row)} />
                    {row.action ? (
                      <span className="mt-2 block sm:hidden">
                        <RowButton
                          label={actionLabel(row)}
                          busy={busy === row.key}
                          disabled={busy !== null}
                          onClick={() => handleStart(row.key, row.resources ?? [], row.action)}
                        />
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden text-right sm:table-cell">
                    {row.action ? (
                      <RowButton
                        label={actionLabel(row)}
                        busy={busy === row.key}
                        disabled={busy !== null}
                        onClick={() => handleStart(row.key, row.resources ?? [], row.action)}
                      />
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </DataCard>
  )
}

type RowButtonProps = { label: string; busy: boolean; disabled: boolean; onClick: () => void }

function RowButton({ label, busy, disabled, onClick }: RowButtonProps) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      {busy ? <Spinner /> : null}
      {label}
    </Button>
  )
}
