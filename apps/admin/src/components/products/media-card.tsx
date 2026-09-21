'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { ImagePlus } from 'lucide-react'
import { productFormContent } from '@/data/products'

type MediaCardProps = {
  images: { id: string; url: string; alt: string | null }[]
}

const copy = productFormContent.media

/** Read-only for now: uploads arrive with the media library PR (extension point: `onDrop`). */
export default function MediaCard({ images }: MediaCardProps) {
  return (
    <Card size="form">
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {images.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
            {images.map((img) => (
              // biome-ignore lint/performance/noImgElement: remote catalogue images, no optimisation pipeline yet.
              <img
                key={img.id}
                src={img.url}
                alt={img.alt ?? ''}
                className="aspect-square w-full rounded-lg border bg-muted object-cover"
              />
            ))}
          </div>
        ) : null}
        <div
          aria-disabled="true"
          className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-8 text-center text-muted-foreground opacity-70"
        >
          <ImagePlus className="size-5" aria-hidden />
          <span className="text-sm font-medium">
            {images.length === 0 ? copy.empty : copy.dropzone}
          </span>
          <span className="text-xs">{copy.uploadSoon}</span>
        </div>
      </CardContent>
    </Card>
  )
}
