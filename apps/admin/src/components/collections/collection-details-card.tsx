'use client'

import type { RichTextValue } from '@commerce/richtext'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import Image from 'next/image'
import { useState } from 'react'
import RichTextField from '@/components/fields/rich-text-field'
import { collectionFormContent as copy } from '@/data/collections'
import CollectionImageDialog from './collection-image-dialog'

type CollectionDetailsCardProps = {
  title: string
  description: unknown
  imageUrl: string | null
  onChange: (patch: {
    title?: string
    description?: unknown
    imageMediaId?: string | null
    imageUrl?: string | null
  }) => void
}

export default function CollectionDetailsCard({
  title,
  description,
  imageUrl,
  onChange,
}: CollectionDetailsCardProps) {
  // Hooks
  const [picking, setPicking] = useState(false)

  // Event handlers
  const handlePicked = (media: { id: string; url: string } | null) => {
    setPicking(false)
    onChange({ imageMediaId: media?.id ?? null, imageUrl: media?.url ?? null })
  }

  // Render logic
  return (
    <Card size="form">
      <CardHeader>
        <CardTitle>{copy.details.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="collection-title">{copy.details.title}</FieldLabel>
            <Input
              id="collection-title"
              size="lg"
              value={title}
              placeholder={copy.details.titlePlaceholder}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </Field>
          <RichTextField
            label={copy.details.description}
            value={description as RichTextValue | null}
            onChange={(value) => onChange({ description: value })}
            minHeight={180}
          />
          <Field>
            <FieldLabel>{copy.details.image}</FieldLabel>
            <div className="flex items-center gap-4">
              <span className="relative size-16 shrink-0 overflow-hidden rounded-sm border border-line bg-background">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt=""
                    width={64}
                    height={64}
                    className="size-full object-cover"
                  />
                ) : null}
              </span>
              <Button variant="outline" onClick={() => setPicking(true)}>
                {imageUrl ? copy.details.changeImage : copy.details.pickImage}
              </Button>
              {imageUrl ? (
                <Button variant="ghost" onClick={() => handlePicked(null)}>
                  {copy.details.removeImage}
                </Button>
              ) : (
                <span className="text-body text-muted-foreground">{copy.details.noImage}</span>
              )}
            </div>
          </Field>
        </FieldGroup>
      </CardContent>
      <CollectionImageDialog
        open={picking}
        onClose={() => setPicking(false)}
        onPick={handlePicked}
      />
    </Card>
  )
}
