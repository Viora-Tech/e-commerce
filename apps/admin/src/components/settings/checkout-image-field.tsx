'use client'

import type { ThemeMediaRef } from '@commerce/core/theme'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import MediaPickDialog from '@/components/media/media-pick-dialog'

type CheckoutImageFieldProps = {
  label: string
  hint: string
  value: ThemeMediaRef | null
  pickLabel: string
  removeLabel: string
  dialogTitle: string
  empty: string
  /** A logo is shown whole; a background fills its box. */
  fit: 'contain' | 'cover'
  onChange: (value: ThemeMediaRef | null) => void
}

/** One image from the media library for the checkout: a small preview, Choose and Remove. */
export default function CheckoutImageField({
  label,
  hint,
  value,
  pickLabel,
  removeLabel,
  dialogTitle,
  empty,
  fit,
  onChange,
}: CheckoutImageFieldProps) {
  // Hooks
  const [picking, setPicking] = useState(false)

  // Event handlers
  const handlePick = (media: { id: string; url: string } | null) => {
    setPicking(false)
    if (media) onChange({ mediaId: media.id, url: media.url })
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-body text-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
          {value ? (
            // biome-ignore lint/performance/noImgElement: a library image previewed at thumbnail size.
            <img
              src={value.url}
              alt=""
              className={`size-full ${fit === 'contain' ? 'object-contain p-1.5' : 'object-cover'}`}
            />
          ) : null}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>
          {pickLabel}
        </Button>
        {value ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            {removeLabel}
          </Button>
        ) : null}
      </div>
      <p className="text-caption text-muted-foreground">{hint}</p>
      <MediaPickDialog
        open={picking}
        title={dialogTitle}
        empty={empty}
        onClose={() => setPicking(false)}
        onPick={handlePick}
      />
    </div>
  )
}
