'use client'

import { ImagePlus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { useState } from 'react'
import MediaPickDialog, { type PickedMedia } from '@/components/media/media-pick-dialog'
import { emailDesignContent } from '@/data/email-design'
import { useCopy } from '@/hooks/use-copy'

type DesignImageFieldProps = {
  src: string
  onPick: (media: { src: string; alt: string }) => void
}

/** The picture of an Image block, from the store's media library (the campaign builder's picker). */
export default function DesignImageField({ src, onPick }: DesignImageFieldProps) {
  // Hooks
  const copy = useCopy(emailDesignContent)
  const [open, setOpen] = useState(false)

  // Event handlers
  const handlePick = (media: PickedMedia | null) => {
    setOpen(false)
    if (media) onPick({ src: media.url, alt: media.alt ?? '' })
  }

  // Render logic
  return (
    <Field>
      <FieldLabel>{copy.fields.image}</FieldLabel>
      {src ? (
        // biome-ignore lint/performance/noImgElement: a thumbnail of the picked media, any host
        <img
          src={src}
          alt=""
          className="max-h-32 w-full rounded-md border border-border object-contain"
        />
      ) : null}
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <ImagePlus aria-hidden="true" />
        {src ? copy.fields.changeImage : copy.fields.chooseImage}
      </Button>
      <MediaPickDialog
        open={open}
        title={copy.fields.imageTitle}
        description={copy.fields.imageDescription}
        onClose={() => setOpen(false)}
        onPick={handlePick}
      />
    </Field>
  )
}
