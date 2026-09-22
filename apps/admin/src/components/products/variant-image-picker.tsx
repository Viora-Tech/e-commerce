'use client'

import { ImageIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { productFormContent } from '@/data/products'
import type { MediaItem } from './form-state'

type VariantImagePickerProps = {
  media: MediaItem[]
  mediaId: string | null
  label: string
  onChange: (mediaId: string | null) => void
}

const copy = productFormContent.variantBulk

/** Pick which gallery image represents this variant. */
export default function VariantImagePicker({
  media,
  mediaId,
  label,
  onChange,
}: VariantImagePickerProps) {
  // Early returns
  if (media.length === 0) {
    return <span className="text-caption text-muted-foreground">{copy.noImage}</span>
  }

  // Render logic
  const current = media.find((m) => m.id === mediaId)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
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
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onClick={() => onChange(null)}>{copy.noImage}</DropdownMenuItem>
        {media.map((item) => (
          <DropdownMenuItem key={item.id} onClick={() => onChange(item.id)}>
            <span className="flex items-center gap-2">
              {/* biome-ignore lint/performance/noImgElement: same reason as the trigger. */}
              <img src={item.url} alt="" className="size-6 rounded object-cover" />
              <span className="truncate">{item.alt ?? copy.chooseImage}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
