'use client'

import { ImageIcon, XIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { useState } from 'react'
import MediaPickDialog, { type MediaItem as PickerItem } from '@/components/media/media-pick-dialog'
import { productFormContent } from '@/data/products'
import type { MediaItem } from './form-state'

type VariantImagePickerProps = {
  media: MediaItem[]
  mediaId: string | null
  label: string
  onChange: (mediaId: string | null) => void
}

const copy = productFormContent.variantBulk

function toPickerItems(media: MediaItem[]): PickerItem[] {
  return media.map((m) => ({
    id: m.id,
    url: m.url,
    alt: m.alt,
    key: null,
    contentType: m.contentType,
    size: null,
  }))
}

/** Pick which gallery image represents this variant, from the product's own media. */
export default function VariantImagePicker({
  media,
  mediaId,
  label,
  onChange,
}: VariantImagePickerProps) {
  // Hooks
  const [picking, setPicking] = useState(false)

  // Event handlers
  const handlePick = (picked: { id: string; url: string } | null) => {
    setPicking(false)
    onChange(picked?.id ?? null)
  }

  // Early returns
  if (media.length === 0) {
    return <span className="text-caption text-muted-foreground">{copy.noImage}</span>
  }

  // Render logic
  const current = media.find((m) => m.id === mediaId)

  return (
    <>
      <span className="relative inline-flex shrink-0">
        <button
          type="button"
          onClick={() => setPicking(true)}
          aria-label={`${copy.image} ${label}`}
          className={cn(
            'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted',
            'transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          {current ? (
            // biome-ignore lint/performance/noImgElement: gallery thumbnails are already sized by the uploader.
            <img src={current.url} alt="" className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-4 text-muted-foreground" />
          )}
        </button>
        {current ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={copy.noImage}
            title={copy.noImage}
            className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-card hover:text-foreground"
          >
            <XIcon className="size-2.5" aria-hidden />
          </button>
        ) : null}
      </span>
      <MediaPickDialog
        open={picking}
        title={`${copy.image}: ${label}`}
        items={toPickerItems(media)}
        onClose={() => setPicking(false)}
        onPick={handlePick}
      />
    </>
  )
}
