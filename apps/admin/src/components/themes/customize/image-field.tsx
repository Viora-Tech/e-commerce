'use client'

import { Button } from '@commerce/ui/shadcn/button'
import Image from 'next/image'
import type { ReactNode } from 'react'
import { useState } from 'react'
import MediaPickDialog from '@/components/media/media-pick-dialog'
import { customizeContent } from '@/data/customize'
import { type FieldLike, isImageField } from '@/lib/customize-field-shape'

type ImageValue = { url?: string; alt?: string } | undefined

type ImageFieldProps = {
  field: FieldLike
  value: unknown
  onChange: (value: unknown) => void
  /** Puck's own rendering of the object's sub-fields. */
  children: ReactNode
}

const copy = customizeContent.image

/**
 * Puck's object field, with a media library picker above it for image objects.
 * Every other object field (buttons, links) renders unchanged.
 */
export default function ImageField({ field, value, onChange, children }: ImageFieldProps) {
  // Hooks
  const [picking, setPicking] = useState(false)

  // Event handlers
  const handlePick = (media: { id: string; url: string } | null) => {
    setPicking(false)
    if (media) onChange({ ...((value ?? {}) as object), url: media.url })
  }

  // Early returns
  if (!isImageField(field)) return <>{children}</>

  // Render logic
  const image = (value ?? {}) as NonNullable<ImageValue>
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
          {image.url ? (
            <Image
              src={image.url}
              alt=""
              width={56}
              height={56}
              className="size-full object-cover"
            />
          ) : null}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>
          {image.url ? copy.change : copy.choose}
        </Button>
        {image.url ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange({ ...image, url: '' })}
          >
            {copy.remove}
          </Button>
        ) : null}
      </div>
      {children}
      <MediaPickDialog
        open={picking}
        title={copy.dialog}
        onClose={() => setPicking(false)}
        onPick={handlePick}
      />
    </div>
  )
}
