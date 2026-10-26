'use client'

import { ImageIcon, XIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { useState } from 'react'
import { productFormContent } from '@/data/product-form'
import { useCopy } from '@/hooks/use-copy'
import type { MediaItem } from './form-state'
import { chosenItems } from './variant-images'
import VariantImagesDialog from './variant-images-dialog'

type VariantImagePickerProps = {
  media: MediaItem[]
  /** The variant's images in order; the first is its main image. */
  mediaIds: string[]
  label: string
  onChange: (mediaIds: string[]) => void
  /** Files uploaded from the dialog join the product gallery. */
  onAddMedia: (items: MediaItem[]) => void
}

/** The variant's main image as a thumbnail (with a count when it has more); opens the images dialog. */
export default function VariantImagePicker({
  media,
  mediaIds,
  label,
  onChange,
  onAddMedia,
}: VariantImagePickerProps) {
  // Hooks
  const { variantBulk: copy, variantImages: imagesCopy } = useCopy(productFormContent)
  const [picking, setPicking] = useState(false)
  /* Bumped on every open, so the dialog's draft starts from the saved list each time. */
  const [opened, setOpened] = useState(0)

  // Event handlers
  const handleOpen = () => {
    setOpened((n) => n + 1)
    setPicking(true)
  }

  const handleSave = (ids: string[]) => {
    setPicking(false)
    onChange(ids)
  }

  // Render logic
  const chosen = chosenItems(mediaIds, media)
  const current = chosen[0]
  const extra = chosen.length - 1

  return (
    <>
      <span className="relative inline-flex shrink-0">
        <button
          type="button"
          onClick={handleOpen}
          aria-label={`${copy.image} ${label}${chosen.length > 1 ? `, ${imagesCopy.count(chosen.length)}` : ''}`}
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
        {extra > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-1.5 -bottom-1.5 rounded-full border border-border bg-card px-1 text-caption leading-tight tabular-nums text-foreground shadow-card"
          >
            {imagesCopy.more(extra)}
          </span>
        ) : null}
        {current ? (
          <button
            type="button"
            onClick={() => onChange([])}
            aria-label={copy.noImage}
            title={copy.noImage}
            className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-card hover:text-foreground"
          >
            <XIcon className="size-2.5" aria-hidden />
          </button>
        ) : null}
      </span>
      <VariantImagesDialog
        key={opened}
        open={picking}
        label={label}
        media={media}
        value={chosen.map((c) => c.id)}
        onClose={() => setPicking(false)}
        onAddMedia={onAddMedia}
        onSave={handleSave}
      />
    </>
  )
}
