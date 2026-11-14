'use client'

import { Search, X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { type ReactNode, useEffect, useState } from 'react'
import ProductThumb from '@/components/products/product-thumb'
import LoadFailed from '@/components/states/load-failed'
import type { LoadFailure } from '@/hooks/use-load'
import { isForbidden } from '@/lib/forbidden'
import ResourcePickDialog from './resource-pick-dialog'
import type { PickItem, PickResult, PickTab } from './resource-pick-types'

type PickedFieldProps = {
  /** The tab the ids belong to. */
  kind: string
  ids: string[]
  tabs: PickTab[]
  /** The dialog's title. */
  title: string
  /** Placeholder on the search-looking field that opens the dialog. */
  search: string
  labels: { browse: string; nothingPicked: string; remove: (title: string) => string }
  /** Rows for ids not seen in the dialog yet (an edited record), fetched by id. */
  loadPicked: (kind: string, ids: string[]) => Promise<PickItem[]>
  onChange: (next: { kind: string; ids: string[] }) => void
  /** Extra control on each picked row, before the remove button (e.g. an amount input). */
  rowExtra?: ((item: PickItem) => ReactNode) | undefined
  /** Opens the caller's own picker instead of the Browse dialog (the products picker with its
   *  filters and stock); picks come back through `onChange` and show by `loadPicked`. */
  onBrowse?: (() => void) | undefined
}

/* At most this many placeholder rows while picked rows are read. */
const MAX_SKELETON_ROWS = 3

/**
 * A form field for picking things through the Browse dialog: a search field and Browse button
 * that open it, then the picks as removable rows with thumbnails (or initials).
 */
export default function PickedField({
  kind,
  ids,
  tabs,
  title,
  search,
  labels,
  loadPicked,
  onChange,
  rowExtra,
  onBrowse,
}: PickedFieldProps) {
  // Hooks
  const [open, setOpen] = useState(false)
  const [known, setKnown] = useState<PickItem[]>([])
  /* The picked rows being read, or why that failed: a failure shows Try again instead of an
     empty field that looks like nothing is picked. `attempt` reads again. */
  const [reading, setReading] = useState(false)
  const [failed, setFailed] = useState<LoadFailure | false>(false)
  const [attempt, setAttempt] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: loadPicked is rebuilt every render
  useEffect(() => {
    const missing = ids.filter((id) => !known.some((p) => p.id === id))
    if (missing.length === 0 || attempt < 0) return
    let cancelled = false
    setReading(true)
    setFailed(false)
    loadPicked(kind, missing)
      .then((found) => {
        if (cancelled) return
        // Same array when nothing new came back (a deleted record): a new one would re-run
        // this effect and fetch again, forever.
        setKnown((prev) => {
          const fresh = found.filter((p) => !prev.some((x) => x.id === p.id))
          return fresh.length > 0 ? [...prev, ...fresh] : prev
        })
      })
      .catch(
        (error: unknown) => !cancelled && setFailed(isForbidden(error) ? 'no-access' : 'error'),
      )
      .finally(() => !cancelled && setReading(false))
    return () => {
      cancelled = true
    }
  }, [kind, ids, known, attempt])

  // Event handlers
  const handleDone = (result: PickResult) => {
    setKnown((prev) => [...prev, ...result.items.filter((i) => !prev.some((p) => p.id === i.id))])
    onChange({ kind: result.tab, ids: result.ids })
    setOpen(false)
  }

  const handleOpen = () => (onBrowse ? onBrowse() : setOpen(true))

  const handleRemove = (id: string) => onChange({ kind, ids: ids.filter((x) => x !== id) })

  // Render logic
  const chosen = ids
    .map((id) => known.find((p) => p.id === id))
    .filter((p): p is PickItem => Boolean(p))
  const waiting = reading ? Math.min(ids.length - chosen.length, MAX_SKELETON_ROWS) : 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleOpen}
          className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-body text-muted-foreground transition-[border-color] hover:border-ring/60"
        >
          <Search className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{search}</span>
        </button>
        <Button type="button" variant="outline" size="lg" onClick={handleOpen}>
          {labels.browse}
        </Button>
      </div>
      {chosen.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {chosen.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              {(p.thumb ?? 'image') === 'image' ? <ProductThumb url={p.imageUrl ?? null} /> : null}
              {p.thumb === 'initial' ? (
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-caption font-medium text-foreground uppercase"
                >
                  {p.title.trim().charAt(0) || '?'}
                </span>
              ) : null}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body-strong">{p.title}</span>
                {p.subtitle || p.meta ? (
                  <span className="truncate text-caption">{p.subtitle ?? p.meta}</span>
                ) : null}
              </span>
              {rowExtra ? <div className="w-32 shrink-0">{rowExtra(p)}</div> : null}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={labels.remove(p.title)}
                onClick={() => handleRemove(p.id)}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : ids.length === 0 ? (
        <p className="text-caption text-muted-foreground">{labels.nothingPicked}</p>
      ) : null}
      {waiting > 0 ? (
        <ul
          aria-hidden="true"
          className="flex flex-col divide-y divide-border rounded-lg border border-border"
        >
          {Array.from({ length: waiting }, (_, i) => (
            <li key={`wait-${i.toString()}`} className="flex items-center gap-3 px-3 py-2">
              <Skeleton className="size-8 shrink-0 rounded-md" />
              <Skeleton className="h-3.5 w-48 max-w-full" />
            </li>
          ))}
        </ul>
      ) : null}
      {failed && chosen.length < ids.length ? (
        <LoadFailed size="inline" failed={failed} onRetry={() => setAttempt((n) => n + 1)} />
      ) : null}
      <ResourcePickDialog
        open={open}
        title={title}
        tabs={tabs}
        selected={{ tab: kind, ids }}
        onClose={() => setOpen(false)}
        onDone={handleDone}
      />
    </div>
  )
}
