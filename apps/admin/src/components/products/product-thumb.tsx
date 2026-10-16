'use client'

import { ImageIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { useState } from 'react'

type ProductThumbProps = { url: string | null; alt?: string; className?: string }

/* 32px tile on a hairline, 6px radius, the picture inset to 28px. With no picture, or one that
   fails to load, the tile shows the image icon (Figma "Table / Cell · Thumb") instead of the
   browser's broken-image glyph. */
export default function ProductThumb({ url, alt = '', className }: ProductThumbProps) {
  // Hooks
  const [failed, setFailed] = useState<string | null>(null)

  // Render logic
  const showImage = url !== null && failed !== url

  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border text-muted-foreground',
        showImage ? 'bg-media' : 'bg-card',
        className,
      )}
    >
      {showImage ? (
        // biome-ignore lint/performance/noImgElement: remote catalogue images, no optimisation pipeline yet.
        <img src={url} alt={alt} className="size-7 object-contain" onError={() => setFailed(url)} />
      ) : (
        <ImageIcon className="size-4" aria-hidden />
      )}
    </span>
  )
}
