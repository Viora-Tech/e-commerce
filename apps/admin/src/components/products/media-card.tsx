'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { useState } from 'react'
import AltTextDialog from '@/components/media/alt-text-dialog'
import MediaDropzone from '@/components/media/media-dropzone'
import MediaGrid from '@/components/media/media-grid'
import type { MediaTileItem } from '@/components/media/media-tile'
import { useUploadQueue } from '@/components/media/use-upload-queue'
import { productFormContent } from '@/data/products'

type MediaCardProps = {
  items: MediaTileItem[]
  /**
   * Update the gallery from its latest value; the form owns the order and
   * saves it with the product. Functional so parallel uploads never clobber
   * each other.
   */
  onChange: (update: (prev: MediaTileItem[]) => MediaTileItem[]) => void
}

const copy = productFormContent.media

/**
 * Uploads go straight to storage and land in the library; the product only
 * remembers which files it shows and in what order, saved with the form.
 */
export default function MediaCard({ items, onChange }: MediaCardProps) {
  // Hooks
  const queue = useUploadQueue((done) => onChange((prev) => [...prev, done]))
  const [editing, setEditing] = useState<MediaTileItem | null>(null)

  // Event handlers
  const handleFiles = (files: File[]) => void queue.start(files)
  const handleReorder = (next: MediaTileItem[]) => onChange(() => next)
  const handleRemove = (item: MediaTileItem) =>
    onChange((prev) => prev.filter((i) => i.id !== item.id))
  const handleAltSaved = (id: string, alt: string | null) =>
    onChange((prev) => prev.map((i) => (i.id === id ? { ...i, alt } : i)))

  // Render logic
  const empty = items.length === 0 && queue.pending.length === 0

  return (
    <Card size="form">
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {empty ? null : (
          <MediaGrid
            items={items}
            pending={queue.pending}
            onReorder={handleReorder}
            onEditAlt={setEditing}
            onRemove={handleRemove}
            onRetry={queue.retry}
            onDismiss={queue.dismiss}
          />
        )}
        <MediaDropzone onFiles={handleFiles} compact={!empty} />
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
