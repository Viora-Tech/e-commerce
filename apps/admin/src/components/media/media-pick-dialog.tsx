'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@commerce/ui/shadcn/dialog'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'

type MediaItem = { id: string; url: string; alt: string | null }

type MediaPickDialogProps = {
  open: boolean
  title: string
  /** Shown when the library has no images yet. */
  empty?: string
  onClose: () => void
  onPick: (media: { id: string; url: string } | null) => void
}

/** Pick an existing library image; uploading happens on the media pages. */
export default function MediaPickDialog({
  open,
  title,
  empty,
  onClose,
  onPick,
}: MediaPickDialogProps) {
  // Hooks
  const [items, setItems] = useState<MediaItem[] | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    api.media.list({ page: 1, perPage: 40 }).then((r) => {
      if (!cancelled) setItems(r.items.map((m) => ({ id: m.id, url: m.url, alt: m.alt })))
    })
    return () => {
      cancelled = true
    }
  }, [open])

  // Render logic
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {items?.length === 0 && empty ? (
          <p className="text-body text-muted-foreground">{empty}</p>
        ) : null}
        <div className="grid max-h-[28rem] grid-cols-4 gap-3 overflow-y-auto">
          {(items ?? []).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onPick({ id: m.id, url: m.url })}
              className="relative aspect-square overflow-hidden rounded-md border border-line transition-shadow hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Image
                src={m.url}
                alt={m.alt ?? ''}
                width={160}
                height={160}
                className="size-full object-cover"
              />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
