'use client'

import { ImageIcon, Video } from '@commerce/ui/icons'
import ActionMenu from '@/components/layout/action-menu'
import FallbackImage from '@/components/layout/fallback-image'
import { mediaContent } from '@/data/media'
import { useCopy } from '@/hooks/use-copy'
import type { MediaTileAction } from './media-tile'
import type { PendingUpload } from './use-upload-queue'

export type MediaFileRow = {
  id: string
  url: string
  alt: string | null
  contentType: string | null
  /** File name shown first; the alt text follows it when it says something else. */
  name: string
  /** "240 KB · Used on 2 products". */
  meta: string
  actions: MediaTileAction[]
}

type MediaFileRowsProps = {
  rows: MediaFileRow[]
  pending: PendingUpload[]
}

/** The Files library as a list: thumbnail, name and alt, size and use, and the same ⋯ menu as a tile. */
export default function MediaFileRows({ rows, pending }: MediaFileRowsProps) {
  // Hooks
  const copy = useCopy(mediaContent)

  // Render logic
  return (
    <ul className="flex flex-col">
      {pending.map((p) => (
        <li key={p.key} className="flex items-center gap-3 border-b border-line px-4 py-2.5">
          <span className="flex size-12 shrink-0 overflow-hidden rounded-md border bg-muted">
            {/* biome-ignore lint/performance/noImgElement: object URL preview while uploading. */}
            <img src={p.previewUrl} alt="" className="size-full object-cover opacity-50" />
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
        const video = row.contentType?.startsWith('video/') ?? false
        return (
          <li
            key={row.id}
            className="group flex items-center gap-3 border-b border-line px-4 py-2.5 transition-colors last:border-0 hover:bg-muted/50"
          >
            <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
              {video ? (
                <Video className="size-5 text-muted-foreground" aria-hidden />
              ) : (
                <FallbackImage
                  src={row.url}
                  alt={row.alt ?? ''}
                  className="size-full object-cover"
                  fallback={<ImageIcon className="size-5 text-muted-foreground" aria-hidden />}
                />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body text-ink-strong">{row.name}</span>
              {row.alt && row.alt.trim() !== row.name.trim() ? (
                <span className="block truncate text-caption text-muted-foreground">{row.alt}</span>
              ) : null}
            </span>
            <span className="hidden shrink-0 text-caption text-muted-foreground sm:block">
              {row.meta}
            </span>
            <ActionMenu
              label={copy.tile.menu}
              variant="bare"
              triggerClassName="size-7 shrink-0 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              items={[
                ...row.actions.filter((a) => !a.destructive),
                ...row.actions
                  .filter((a) => a.destructive)
                  .map((a) => ({ ...a, destructive: true as const })),
              ]}
            />
          </li>
        )
      })}
    </ul>
  )
}
