'use client'

import { ImageIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import Image from 'next/image'
import { useState } from 'react'
import MediaPickDialog from '@/components/media/media-pick-dialog'
import { articleFormContent } from '@/data/blog'
import { useCopy } from '@/hooks/use-copy'

type ImagePatch = { imageMediaId?: string | null; imageUrl?: string | null; imageAlt?: string }

type ArticleImageCardProps = {
  imageUrl: string | null
  imageAlt: string
  onChange: (patch: ImagePatch) => void
}

/** Featured image from the media library, with its alt text. */
export default function ArticleImageCard({ imageUrl, imageAlt, onChange }: ArticleImageCardProps) {
  // Hooks
  const { image: copy } = useCopy(articleFormContent)
  const [picking, setPicking] = useState(false)

  // Event handlers
  const handlePicked = (media: { id: string; url: string } | null) => {
    setPicking(false)
    onChange({ imageMediaId: media?.id ?? null, imageUrl: media?.url ?? null })
  }

  // Render logic
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {imageUrl ? (
          <span className="relative block aspect-video overflow-hidden rounded-md border border-line bg-background">
            <Image src={imageUrl} alt={imageAlt} fill sizes="20rem" className="object-cover" />
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="flex aspect-video flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line text-body text-muted-foreground hover:bg-muted"
          >
            <ImageIcon className="size-6" aria-hidden />
            {copy.pick}
          </button>
        )}
        {imageUrl ? (
          <>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPicking(true)}>
                {copy.change}
              </Button>
              <Button variant="ghost" onClick={() => handlePicked(null)}>
                {copy.remove}
              </Button>
            </div>
            <Field>
              <FieldLabel htmlFor="article-image-alt">{copy.alt}</FieldLabel>
              <Input
                id="article-image-alt"
                size="lg"
                value={imageAlt}
                maxLength={200}
                onChange={(e) => onChange({ imageAlt: e.target.value })}
              />
              <FieldDescription>{copy.altHelp}</FieldDescription>
            </Field>
          </>
        ) : null}
      </CardContent>
      <MediaPickDialog
        open={picking}
        title={copy.pick}
        empty={copy.empty}
        onClose={() => setPicking(false)}
        onPick={handlePicked}
      />
    </Card>
  )
}
