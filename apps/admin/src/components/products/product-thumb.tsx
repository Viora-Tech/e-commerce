'use client'

import { ImageIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import FallbackImage from '@/components/layout/fallback-image'

type ProductThumbProps = { url: string | null; alt?: string; className?: string }

/* 32px tile on a hairline, 6px radius, the picture inset to 28px. With no picture, or one that
   fails to load, the tile shows the image icon (Figma "Table / Cell · Thumb") instead of the
   browser's broken-image glyph. */
export default function ProductThumb({ url, alt = '', className }: ProductThumbProps) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card text-muted-foreground',
        className,
      )}
    >
      <FallbackImage
        src={url}
        alt={alt}
        className="size-7 bg-media object-contain"
        fallback={<ImageIcon className="size-4" aria-hidden />}
      />
    </span>
  )
}
