'use client'

import { ImageIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import MediaPickDialog, { type PickedMedia } from '@/components/media/media-pick-dialog'
import { campaignEditorContent } from '@/data/marketing-campaigns'
import { useCopy } from '@/hooks/use-copy'

type EmailImageFieldProps = {
  id: string
  value: string
  onChange: (url: string) => void
}

/** An email image's address, filled from the media library (upload or pick) or pasted (#1025). */
export default function EmailImageField({ id, value, onChange }: EmailImageFieldProps) {
  // Hooks
  const { fields: copy } = useCopy(campaignEditorContent)
  const [open, setOpen] = useState(false)

  // Event handlers
  const handlePick = (media: PickedMedia | null) => {
    setOpen(false)
    if (!media) return
    // An inbox has no base URL: a root-relative file gets this admin's origin, which serves media.
    onChange(
      /^https?:\/\//i.test(media.url) ? media.url : new URL(media.url, window.location.origin).href,
    )
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>{copy.imageUrl}</FieldLabel>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          placeholder="https://"
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1"
        />
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          <ImageIcon aria-hidden="true" />
          {copy.chooseImage}
        </Button>
      </div>
      {value ? (
        // biome-ignore lint/performance/noImgElement: any pasted address, outside next/image's allowed hosts.
        <img
          src={value}
          alt=""
          className="mt-1 max-h-32 w-auto rounded-md border border-border object-contain"
        />
      ) : null}
      <MediaPickDialog
        open={open}
        title={copy.chooseImage}
        description={copy.chooseImageBody}
        onClose={() => setOpen(false)}
        onPick={handlePick}
      />
    </Field>
  )
}
