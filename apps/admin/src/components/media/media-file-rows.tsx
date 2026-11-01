'use client'

import type { MediaVariants } from '@commerce/core/media-loader'
import { ImageIcon, Video } from '@commerce/ui/icons'
import Link from 'next/link'
import ActionMenu from '@/components/layout/action-menu'
import FallbackImage from '@/components/layout/fallback-image'
import { mediaContent } from '@/data/media'
import { useCopy } from '@/hooks/use-copy'
import { contentTypeOf } from './file-meta'
import MediaAltCell from './media-alt-cell'
import type { MediaTileAction } from './media-tile'
import { tileImageUrls } from './tile-sources'
import type { PendingUpload } from './use-upload-queue'

export type MediaFileRow = {
  id: string
  url: string
  alt: string | null
  contentType: string | null
  /** The pipeline's smaller copies; the 3rem thumbnail uses the smallest instead of the original. */
  variants?: MediaVariants
  /** File name shown first; the alt text follows it when it says something else. */
  name: string
  /** "240 KB · Used on 2 products". */
  meta: string
  actions: MediaTileAction[]
  /** The file's page; the whole row becomes a link to it. */
  href: string
}

type MediaFileRowsProps = {
  rows: MediaFileRow[]
  pending: PendingUpload[]
  /** Turns on the alt text column, edited in place (#91). */
  onAltSaved?: ((id: string, alt: string | null) => void) | undefined
}

/** The Files library as a list: thumbnail, name and alt, size and use, and the same ⋯ menu as a tile. */
export default function MediaFileRows({ rows, pending, onAltSaved }: MediaFileRowsProps) {
  // Hooks
  const copy = useCopy(mediaContent)

  // Render logic
  return (
    <ul className="flex flex-col">
      {onAltSaved && rows.length > 0 ? (
        <li
          aria-hidden="true"
          className="hidden items-center gap-3 border-b border-line bg-muted px-4 py-2 text-table-head text-muted-foreground md:flex"
        >
          <span className="w-12 shrink-0" />
          <span className="min-w-0 flex-1">{copy.library.nameColumn}</span>
          <span className="w-64 shrink-0">{copy.library.altColumn}</span>
          <span className="w-40 shrink-0" />
          <span className="w-7 shrink-0" />
        </li>
      ) : null}
      {pending.map((p) => (
        <li key={p.key} className="flex items-center gap-3 border-b border-line px-4 py-2.5">
          <span className="flex size-12 shrink-0 overflow-hidden rounded-md border bg-muted">
            {p.file.type.startsWith('video/') ? (
              <video
                src={p.previewUrl}
                muted
                playsInline
                preload="metadata"
                className="size-full object-cover opacity-50"
              />
            ) : (
              /* biome-ignore lint/performance/noImgElement: object URL preview while uploading. */
              <img src={p.previewUrl} alt="" className="size-full object-cover opacity-50" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body text-ink-strong">{p.name}</span>
            <span className="block text-caption text-muted-foreground">
              {p.error ? copy.tile.failed : copy.tile.uploading(Math.round(p.progress * 100))}
            </span>
          </span>
        </li>
      ))}
      {rows.map((row) => {
        const video = contentTypeOf(row.contentType, row.url)?.startsWith('video/') ?? false
        return (
          <li
            key={row.id}
            className="group relative flex items-center gap-3 border-b border-line px-4 py-2.5 transition-colors last:border-0 hover:bg-muted/50"
          >
            <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
              {video ? (
                <Video className="size-5 text-muted-foreground" aria-hidden />
              ) : (
                <FallbackImage
                  src={tileImageUrls(row, 320)[0]}
                  alt={row.alt ?? ''}
                  className="size-full object-cover"
                  fallback={<ImageIcon className="size-5 text-muted-foreground" aria-hidden />}
                />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body text-ink-strong">{row.name}</span>
              {!onAltSaved && row.alt && row.alt.trim() !== row.name.trim() ? (
                <span className="block truncate text-caption text-muted-foreground">{row.alt}</span>
              ) : null}
            </span>
            {onAltSaved ? (
              <span className="hidden w-64 shrink-0 md:block">
                <MediaAltCell
                  key={`${row.id}-${row.alt ?? ''}`}
                  id={row.id}
                  name={row.name}
                  alt={row.alt}
                  onSaved={onAltSaved}
                />
              </span>
            ) : null}
            <span
              className={
                onAltSaved
                  ? 'hidden w-40 shrink-0 truncate text-caption text-muted-foreground sm:block'
                  : 'hidden shrink-0 text-caption text-muted-foreground sm:block'
              }
            >
              {row.meta}
            </span>
            <ActionMenu
              label={copy.tile.menu}
              variant="bare"
              triggerClassName="relative z-20 size-7 shrink-0 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              items={[
                ...row.actions.filter((a) => !a.destructive),
                ...row.actions
                  .filter((a) => a.destructive)
                  .map((a) => ({ ...a, destructive: true as const })),
              ]}
            />
            {/* Over the row, under the ⋯ menu (z-20), so the menu keeps its own click. */}
            <Link
              href={row.href}
              aria-label={copy.details.open(row.name)}
              className="absolute inset-0 z-10 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            />
          </li>
        )
      })}
    </ul>
  )
}
