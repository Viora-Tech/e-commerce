'use client'

import type { ThemeMediaRef } from '@commerce/core/theme'
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

/** The Open Graph image, picked from the media library and shown at share-card shape. */
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
      <div className="relative flex aspect-[1200/628] w-full max-w-md items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
        {value ? (
          <Image src={value.url} alt="" fill sizes="28rem" className="object-cover" />
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={() => setPicking(true)}>
          {value ? copy.change : copy.pick}
        </Button>
        {value ? (
          <Button type="button" variant="ghost" onClick={() => onChange(null)}>
            {copy.remove}
          </Button>
        ) : null}
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
