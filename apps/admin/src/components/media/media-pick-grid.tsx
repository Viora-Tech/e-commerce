'use client'

import { Video } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import type { CSSProperties, KeyboardEvent } from 'react'
import { mediaContent } from '@/data/media'
import { useCopy } from '@/hooks/use-copy'
import {
  extLabel,
  filenameFrom,
  formatMediaSize,
  isVideoMedia,
  type MediaItem,
} from './media-pick-types'
import MediaThumb from './media-thumb'
import type { PendingUpload } from './use-upload-queue'

type MediaPickGridProps = {
  view: 'grid' | 'list'
  pending: PendingUpload[]
  results: MediaItem[]
  selectedIds: string[]
  multiple: boolean
  onToggle: (id: string) => void
  onConfirm: (id: string) => void
  onRetry: (key: string) => void
  onDismiss: (key: string) => void
}

/** How many columns a CSS grid is currently laying out, for arrow-key moves between rows. */
function columnsOf(el: HTMLElement): number {
  const template = getComputedStyle(el).gridTemplateColumns
  return Math.max(1, template.split(' ').filter(Boolean).length)
}

/**
 * Arrow keys move focus between tiles (up and down by a whole row in the
 * grid), Home and End jump to the ends. Space or Enter still toggles the
 * focused tile, as any button does.
 */
function handleTileKeys(e: KeyboardEvent<HTMLUListElement>, grid: boolean) {
  const tiles = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-media-tile]')]
  const at = tiles.indexOf(document.activeElement as HTMLElement)
  if (at === -1) return
  const step = grid ? columnsOf(e.currentTarget) : 1
  const moves: Record<string, number> = {
    ArrowRight: grid ? 1 : 0,
    ArrowLeft: grid ? -1 : 0,
    ArrowDown: step,
    ArrowUp: -step,
    Home: -at,
    End: tiles.length - 1 - at,
  }
  const move = moves[e.key]
  if (!move) return
  e.preventDefault()
  tiles[Math.min(tiles.length - 1, Math.max(0, at + move))]?.focus()
}

/** The picker's results area: pending uploads plus the selectable grid or list. */
export default function MediaPickGrid({
  view,
  pending,
  results,
  selectedIds,
  multiple,
  onToggle,
  onConfirm,
  onRetry,
  onDismiss,
}: MediaPickGridProps) {
  // Hooks
  const { picker: copy } = useCopy(mediaContent)

  // Event handlers
  const handleDoubleClick = (id: string) => {
    onToggle(id)
    if (!multiple) onConfirm(id)
  }

  // Render logic
  if (view === 'list') {
    return (
      <ul className="flex flex-col gap-1" onKeyDown={(e) => handleTileKeys(e, false)}>
        {results.map((item) => {
          const active = selectedIds.includes(item.id)
          return (
            <li key={item.id}>
              <button
                type="button"
                data-media-tile
                onClick={() => onToggle(item.id)}
                onDoubleClick={() => handleDoubleClick(item.id)}
                aria-pressed={active}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active ? 'bg-accent' : 'hover:bg-muted',
                )}
              >
                <Checkbox checked={active} tabIndex={-1} />
                <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted p-1">
                  <MediaThumb item={item} className="object-contain" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body">
                    {item.alt || filenameFrom(item.key) || copy.title}
                  </span>
                  <span className="block text-caption text-muted-foreground">
                    {[extLabel(item), formatMediaSize(item.size)].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <ul
      className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5"
      onKeyDown={(e) => handleTileKeys(e, true)}
    >
      {pending.map((p) => {
        const pct = Math.round(p.progress * 100)
        return (
          <li key={p.key} className="flex flex-col gap-1">
            <div className="relative flex aspect-square flex-col justify-end overflow-hidden rounded-lg border bg-muted">
              {/* biome-ignore lint/performance/noImgElement: object URL preview while uploading. */}
              <img
                src={p.previewUrl}
                alt=""
                className="absolute inset-0 size-full object-contain p-2 opacity-50"
              />
              <div className="relative flex flex-col gap-1.5 bg-card/95 p-2">
                {p.error ? (
                  <span className="flex flex-wrap gap-1">
                    <Button size="xs" variant="outline" onClick={() => onRetry(p.key)}>
                      {copy.retry}
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => onDismiss(p.key)}>
                      {copy.dismiss}
                    </Button>
                  </span>
                ) : (
                  <span
                    role="progressbar"
                    aria-label={copy.uploading(p.name, pct)}
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-1 overflow-hidden rounded-full bg-muted"
                  >
                    <span
                      className="block h-full rounded-full w-(--w) bg-primary transition-[width] duration-150 motion-reduce:transition-none"
                      style={{ '--w': `${pct}%` } as CSSProperties}
                    />
                  </span>
                )}
              </div>
            </div>
            <div className="px-0.5">
              <p className="truncate text-caption text-foreground">{p.name}</p>
              <p
                className={cn(
                  'text-caption tabular-nums',
                  p.error ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {p.error ? mediaContent.tile.failed : `${pct}%`}
              </p>
            </div>
          </li>
        )
      })}
      {results.map((item) => {
        const active = selectedIds.includes(item.id)
        return (
          <li key={item.id} className="flex flex-col gap-1">
            <button
              type="button"
              data-media-tile
              onClick={() => onToggle(item.id)}
              onDoubleClick={() => handleDoubleClick(item.id)}
              aria-pressed={active}
              aria-label={item.alt || filenameFrom(item.key)}
              className={cn(
                'group relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border bg-muted p-2 motion-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active ? 'bg-accent ring-2 ring-primary' : 'hover:shadow-card-hover',
              )}
            >
              <span className="absolute top-1.5 left-1.5 z-10">
                {multiple && active ? (
                  <span
                    className="flex size-5 items-center justify-center rounded-md bg-primary text-caption font-semibold text-primary-foreground tabular-nums"
                    title={copy.order(selectedIds.indexOf(item.id) + 1)}
                  >
                    {selectedIds.indexOf(item.id) + 1}
                  </span>
                ) : (
                  <Checkbox checked={active} tabIndex={-1} />
                )}
              </span>
              <MediaThumb item={item} className="object-contain" />
              {isVideoMedia(item.contentType) ? (
                <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-md bg-card/90 px-1.5 py-0.5 text-caption text-foreground">
                  <Video className="size-3" aria-hidden />
                </span>
              ) : null}
            </button>
            <div className="px-0.5">
              <p className="truncate text-caption text-foreground">
                {item.alt || filenameFrom(item.key) || copy.title}
              </p>
              <p className="text-caption text-muted-foreground">{extLabel(item)}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
