'use client'

import type { ThemeMediaRef } from '@commerce/core/theme'
import { Button } from '@commerce/ui/shadcn/button'
import Image from 'next/image'
import { useState } from 'react'
import MediaPickDialog from '@/components/media/media-pick-dialog'
import { themesContent as copy } from '@/data/themes'

type MediaSlotProps = {
  label: string
  help: string
  dialogTitle: string
  value: ThemeMediaRef | null
  onChange: (value: ThemeMediaRef | null) => void
}

/** One brand image (logo, favicon) picked from the media library. */
export default function MediaSlot({ label, help, dialogTitle, value, onChange }: MediaSlotProps) {
  // Hooks
  const [picking, setPicking] = useState(false)

  // Event handlers
  const handlePick = (media: { id: string; url: string } | null) => {
    setPicking(false)
    if (media) onChange({ mediaId: media.id, url: media.url })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-body text-foreground">{label}</span>
        <p className="text-caption text-muted-foreground">{help}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
          {value ? (
            <Image
              src={value.url}
              alt=""
              width={56}
              height={56}
              className="size-full object-contain"
            />
          ) : null}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>
          {value ? copy.brand.change : copy.brand.pick}
        </Button>
        {value ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            {copy.brand.remove}
          </Button>
        ) : null}
      </div>
      <MediaPickDialog
        open={picking}
        title={dialogTitle}
        empty={copy.brand.emptyLibrary}
        onClose={() => setPicking(false)}
        onPick={handlePick}
      />
    </div>
  )
}
