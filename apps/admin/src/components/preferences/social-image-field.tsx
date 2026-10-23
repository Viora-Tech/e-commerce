'use client'

import type { ThemeMediaRef } from '@commerce/core/theme'
import { ImageIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Image from 'next/image'
import { useState } from 'react'
import MediaPickDialog from '@/components/media/media-pick-dialog'
import { preferencesContent } from '@/data/preferences'

type SocialImageFieldProps = {
  value: ThemeMediaRef | null
  onChange: (value: ThemeMediaRef | null) => void
}

const copy = preferencesContent.social

/**
 * The Open Graph image, picked from the media library and shown at share-card shape. Empty,
 * the whole share-card box is the button that opens the picker; the actions sit on the right.
 */
export default function SocialImageField({ value, onChange }: SocialImageFieldProps) {
  // Hooks
  const [picking, setPicking] = useState(false)

  // Event handlers
  const handlePick = (media: { id: string; url: string } | null) => {
    setPicking(false)
    if (media) onChange({ mediaId: media.id, url: media.url })
  }

  // Render logic
  return (
    <div className="flex flex-col gap-3">
      {value ? (
        <button
          type="button"
          onClick={() => setPicking(true)}
          aria-label={copy.change}
          className="relative block aspect-[1200/628] w-full overflow-hidden rounded-lg border border-border bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Image src={value.url} alt="" fill sizes="40rem" className="object-cover" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex aspect-[1200/628] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 text-center transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-background text-muted-foreground">
            <ImageIcon className="size-5" aria-hidden />
          </span>
          <span className="text-body-strong text-foreground">{copy.placeholder}</span>
          <span className="text-caption text-muted-foreground">{copy.placeholderHint}</span>
        </button>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {value ? (
          <Button type="button" variant="ghost" onClick={() => onChange(null)}>
            {copy.remove}
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={() => setPicking(true)}>
          {value ? copy.change : copy.pick}
        </Button>
      </div>
      <MediaPickDialog
        open={picking}
        title={copy.dialog}
        empty={copy.empty}
        onClose={() => setPicking(false)}
        onPick={handlePick}
      />
    </div>
  )
}
