'use client'

import { ImageIcon, Plus, RefreshCw, X } from '@commerce/ui/icons'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { useRef, useState } from 'react'
import AltTextDialog from '@/components/media/alt-text-dialog'
import type { MediaTileItem } from '@/components/media/media-tile'
import { useUploadQueue } from '@/components/media/use-upload-queue'
import { productFormContent } from '@/data/products'

type ProductImageCardProps = {
  items: MediaTileItem[]
  /** Functional update so parallel uploads never clobber each other. */
  onChange: (update: (prev: MediaTileItem[]) => MediaTileItem[]) => void
  /** Uploads are in flight, so saving is blocked upstream. */
  onUploading?: ((busy: boolean) => void) | undefined
}

const copy = productFormContent.media

const ACCEPT = 'image/*,video/mp4'

/** Frame 5:5208: a 266px cover well with Browse and Replace, then a strip of 98px thumbs and the dashed add tile. */
export default function ProductImageCard({ items, onChange, onUploading }: ProductImageCardProps) {
  // Hooks
  const queue = useUploadQueue((done) => onChange((prev) => [...prev, done]))
  const [editing, setEditing] = useState<MediaTileItem | null>(null)
  const browseRef = useRef<HTMLInputElement>(null)
  const replaceRef = useRef<HTMLInputElement>(null)

  // Event handlers
  const handlePicked = (files: FileList | null, replaceCover: boolean) => {
    const list = files ? Array.from(files) : []
    if (!list.length) return
    if (replaceCover && items[0]) onChange((prev) => prev.slice(1))
    onUploading?.(true)
    void queue.start(list).finally(() => onUploading?.(false))
  }

  const handleRemove = (item: MediaTileItem) =>
    onChange((prev) => prev.filter((i) => i.id !== item.id))

  const handleAltSaved = (id: string, alt: string | null) =>
    onChange((prev) => prev.map((i) => (i.id === id ? { ...i, alt } : i)))

  // Render logic
  const [cover, ...rest] = items
  const pending = queue.pending

  return (
    <Card size="form" className="gap-6 p-6">
      <CardContent className="flex flex-col gap-6 p-0">
        <h2 className="text-kit-heading text-foreground">{copy.heading}</h2>

        <div className="flex flex-col gap-3">
          <p className="text-kit-field text-ink-strong">{copy.label}</p>
          <div className="relative h-[16.625rem] overflow-hidden rounded-lg border border-secondary bg-card">
            {cover ? (
              // biome-ignore lint/performance/noImgElement: media comes from arbitrary storage hosts.
              <img
                src={cover.url}
                alt={cover.alt ?? copy.coverAlt}
                className="size-full object-contain"
              />
            ) : (
              <button
                type="button"
                onClick={() => browseRef.current?.click()}
                className="flex size-full flex-col items-center justify-center gap-2 text-kit-body text-muted-foreground"
              >
                <ImageIcon className="size-6" aria-hidden="true" />
                {copy.empty}
              </button>
            )}
            <button
              type="button"
              onClick={() => browseRef.current?.click()}
              className="absolute bottom-3 left-3 flex h-9 items-center gap-1 rounded-lg border border-secondary bg-card px-3 text-kit-body text-muted-foreground hover:bg-background"
            >
              <ImageIcon className="size-5" aria-hidden="true" />
              {copy.browse}
            </button>
            {cover ? (
              <button
                type="button"
                onClick={() => replaceRef.current?.click()}
                className="absolute right-3 bottom-3 flex h-9 items-center gap-2 rounded-lg bg-card p-2 text-kit-body text-foreground shadow-lift hover:bg-background"
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                {copy.replace}
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          {rest.map((item) => (
            <div
              key={item.id}
              className="relative size-[6.125rem] overflow-hidden rounded-lg border border-secondary"
            >
              <button
                type="button"
                onClick={() => setEditing(item)}
                className="size-full"
                aria-label={item.alt ?? item.url}
              >
                {/* biome-ignore lint/performance/noImgElement: media comes from arbitrary storage hosts. */}
                <img src={item.url} alt={item.alt ?? ''} className="size-full object-cover" />
              </button>
              <button
                type="button"
                onClick={() => handleRemove(item)}
                aria-label={copy.remove(item.alt ?? item.url)}
                className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-card text-muted-foreground shadow-lift hover:text-foreground"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </div>
          ))}
          {pending.map((p) => (
            <div
              key={p.key}
              className="flex size-[6.125rem] items-center justify-center rounded-lg border border-secondary bg-muted text-kit-body text-muted-foreground"
            >
              {p.error ? p.error : `${p.progress}%`}
            </div>
          ))}
          <button
            type="button"
            onClick={() => browseRef.current?.click()}
            className="flex h-[6.125rem] min-w-[12.5rem] flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-muted-foreground-soft border-dashed text-primary hover:bg-background"
          >
            <Plus className="size-6" aria-hidden="true" />
            <span className="text-kit-field">{copy.add}</span>
          </button>
        </div>

        <input
          ref={browseRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          onChange={(e) => handlePicked(e.target.files, false)}
        />
        <input
          ref={replaceRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => handlePicked(e.target.files, true)}
        />
        <AltTextDialog
          key={editing?.id ?? 'none'}
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={handleAltSaved}
        />
      </CardContent>
    </Card>
  )
}
