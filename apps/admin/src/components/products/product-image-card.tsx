'use client'

import { ImageIcon, Plus, RefreshCw, X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useRef, useState } from 'react'
import DataCard from '@/components/layout/data-card'
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
    <DataCard
      title={copy.heading}
      action={
        <Button variant="outline" size="sm" onClick={() => browseRef.current?.click()}>
          <ImageIcon aria-hidden="true" />
          {copy.browse}
        </Button>
      }
    >
      {/* Media grid after the Saleor Dashboard product media card (BSD-3): the cover spans
          two by two, the rest are square tiles, the last tile adds more. */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-5">
        <div className="group/cover relative col-span-2 row-span-2 aspect-square overflow-hidden rounded-lg border border-border bg-muted/40">
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
              className="flex size-full flex-col items-center justify-center gap-2 text-body text-muted-foreground transition-colors hover:text-foreground"
            >
              <ImageIcon className="size-6" aria-hidden="true" />
              {copy.empty}
            </button>
          )}
          {cover ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => replaceRef.current?.click()}
              className="absolute right-2 bottom-2"
            >
              <RefreshCw aria-hidden="true" />
              {copy.replace}
            </Button>
          ) : null}
        </div>
        {rest.map((item) => (
          <div
            key={item.id}
            className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted/40"
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
              className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}
        {pending.map((p) => (
          <div
            key={p.key}
            className="flex aspect-square items-center justify-center rounded-lg border border-border bg-muted p-2 text-center text-caption text-muted-foreground"
          >
            {p.error ? p.error : `${p.progress}%`}
          </div>
        ))}
        <button
          type="button"
          onClick={() => browseRef.current?.click()}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-border-strong border-dashed text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          <Plus className="size-5" aria-hidden="true" />
          <span className="text-caption">{copy.add}</span>
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
    </DataCard>
  )
}
