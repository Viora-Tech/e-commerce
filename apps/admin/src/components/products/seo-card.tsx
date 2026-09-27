'use client'

import { type RichTextValue, richTextToPlainText } from '@commerce/richtext'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@commerce/ui/shadcn/input-group'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useState } from 'react'
import { productFormContent } from '@/data/products'
import { useCopy } from '@/hooks/use-copy'

type SeoCardProps = {
  title: string
  description: RichTextValue | null
  seoTitle: string
  seoDescription: string
  handle: string
  storefrontOrigin: string
  onSeoTitle: (value: string) => void
  onSeoDescription: (value: string) => void
  onHandle: (value: string) => void
}

const TITLE_MAX = 70
const DESCRIPTION_MAX = 320
const PREVIEW_CHARS = 160

export default function SeoCard({
  title,
  description,
  seoTitle,
  seoDescription,
  handle,
  storefrontOrigin,
  onSeoTitle,
  onSeoDescription,
  onHandle,
}: SeoCardProps) {
  // Hooks
  const { seo: copy } = useCopy(productFormContent)
  const [editing, setEditing] = useState(Boolean(seoTitle || seoDescription))

  // Render logic
  const previewTitle = seoTitle || title
  const previewDescription = (seoDescription || richTextToPlainText(description)).slice(
    0,
    PREVIEW_CHARS,
  )

  const url = `${storefrontOrigin}${copy.handlePrefix}${handle}`

  return (
    <Card size="form">
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
        <CardDescription>{copy.intro}</CardDescription>
        {!editing ? (
          <CardAction>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
              {copy.edit}
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {previewTitle ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{url}</span>
            <span className="text-base font-medium text-link">{previewTitle}</span>
            <span className="text-body text-muted-foreground">{previewDescription}</span>
          </div>
        ) : (
          <p className="text-body text-muted-foreground">{copy.previewHint}</p>
        )}
        {editing ? (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="seo-title">{copy.title}</FieldLabel>
              <Input
                size="lg"
                id="seo-title"
                value={seoTitle}
                onChange={(e) => onSeoTitle(e.target.value)}
                placeholder={title}
                maxLength={TITLE_MAX}
                autoComplete="off"
              />
              <FieldDescription>{copy.titleHelp(seoTitle.length)}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="seo-description">{copy.description}</FieldLabel>
              <Textarea
                size="lg"
                id="seo-description"
                value={seoDescription}
                onChange={(e) => onSeoDescription(e.target.value)}
                rows={3}
                maxLength={DESCRIPTION_MAX}
              />
              <FieldDescription>{copy.descriptionHelp(seoDescription.length)}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="seo-handle">{copy.handle}</FieldLabel>
              <InputGroup size="lg">
                <InputGroupAddon>
                  <InputGroupText>{copy.handlePrefix}</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id="seo-handle"
                  value={handle}
                  onChange={(e) => onHandle(e.target.value)}
                  autoComplete="off"
                />
              </InputGroup>
            </Field>
          </FieldGroup>
        ) : null}
      </CardContent>
    </Card>
  )
}
