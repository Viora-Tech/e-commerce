'use client'

import { Button } from '@commerce/ui/shadcn/button'
import type { CSSProperties } from 'react'
import type { PendingUpload } from '@/components/media/use-upload-queue'
import { productFormContent } from '@/data/product-form'
import { useCopy } from '@/hooks/use-copy'

type ProductImagePendingProps = {
  upload: PendingUpload
  onRetry: () => void
  onDismiss: () => void
}

/** An image still uploading into the gallery: its preview, a progress bar, or Retry / Dismiss. */
export default function ProductImagePending({
  upload,
  onRetry,
  onDismiss,
}: ProductImagePendingProps) {
  // Hooks
  const { media: copy } = useCopy(productFormContent)

  // Render logic
  const pct = Math.round(upload.progress * 100)

  return (
    <li className="relative flex aspect-square flex-col justify-end overflow-hidden rounded-lg border border-border bg-muted">
      {/* biome-ignore lint/performance/noImgElement: object URL preview while uploading. */}
      <img
        src={upload.previewUrl}
        alt=""
        className="absolute inset-0 size-full object-cover opacity-50"
      />
      <div className="relative flex flex-col gap-1.5 bg-card/95 p-2" aria-live="polite">
        {upload.error ? (
          <>
            <span className="line-clamp-2 text-caption text-destructive">{upload.error}</span>
            <span className="flex gap-1">
              <Button size="xs" variant="outline" onClick={onRetry}>
                {copy.retry}
              </Button>
              <Button size="xs" variant="ghost" onClick={onDismiss}>
                {copy.dismiss}
              </Button>
            </span>
          </>
        ) : (
          <>
            <span className="text-caption tabular-nums">{copy.uploading(pct)}</span>
            <span className="h-1 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full w-(--w) bg-primary transition-[width] duration-150 motion-reduce:transition-none"
                style={{ '--w': `${pct}%` } as CSSProperties}
              />
            </span>
          </>
        )}
      </div>
    </li>
  )
}
