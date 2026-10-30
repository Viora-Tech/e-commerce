'use client'

import { seoSnippet } from '@commerce/core/catalog'
import { type RichTextValue, richTextToPlainText } from '@commerce/richtext'
import { Pencil } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
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
import DataCard from '@/components/layout/data-card'
import { productFormContent } from '@/data/product-form'
import { productPageContent } from '@/data/product-page'
import { useCopy } from '@/hooks/use-copy'

type SeoCardProps = {
  title: string
  description: RichTextValue | null
  seoTitle: string
  seoDescription: string
  handle: string
  storefrontOrigin: string
  /** The product's first photo: what a shared link shows (no separate share image is stored). */
  image: { url: string; alt: string | null } | null
  onSeoTitle: (value: string) => void
  onSeoDescription: (value: string) => void
  onHandle: (value: string) => void
}

const TITLE_MAX = 70
const DESCRIPTION_MAX = 320
const PREVIEW_CHARS = 160
/** Social cards cut the description much shorter than Google does. */
const SHARE_CHARS = 110

function hostOf(origin: string): string {
  try {
    return new URL(origin).host
  } catch {
    return origin
  }
}

export default function SeoCard({
  title,
  description,
  seoTitle,
  seoDescription,
  handle,
  storefrontOrigin,
  image,
  onSeoTitle,
  onSeoDescription,
  onHandle,
}: SeoCardProps) {
  // Hooks
  const { seo: copy } = useCopy(productFormContent)
  const { social } = useCopy(productPageContent)
  const [editing, setEditing] = useState(Boolean(seoTitle || seoDescription))

  // Render logic
  const previewTitle = seoTitle || title
  const previewDescription = (seoDescription || seoSnippet(richTextToPlainText(description))).slice(
    0,
    PREVIEW_CHARS,
  )

  const url = `${storefrontOrigin}${copy.handlePrefix}${handle}`
  const shareDescription = previewDescription.slice(0, SHARE_CHARS)

  return (
    <DataCard
      title={copy.heading}
      subtitle={copy.intro}
      action={
        !editing ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil aria-hidden="true" />
            {copy.edit}
          </Button>
        ) : null
      }
      bodyClassName="flex flex-col gap-4"
    >
      {previewTitle ? (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="flex min-w-0 flex-col gap-2">
            <h3 className="text-caption font-medium text-muted-foreground">{social.google}</h3>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-xs text-muted-foreground">{url}</span>
              <span className="text-base font-medium text-link">{previewTitle}</span>
              <span className="text-body text-muted-foreground">{previewDescription}</span>
            </div>
          </section>
          <section className="flex min-w-0 flex-col gap-2">
            <h3 className="text-caption font-medium text-muted-foreground">{social.heading}</h3>
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {image ? (
                // biome-ignore lint/performance/noImgElement: a preview of the merchant's own media URL
                <img
                  src={image.url}
                  alt={image.alt ?? ''}
                  className="aspect-[1.91/1] w-full bg-muted object-cover"
                />
              ) : (
                <div className="flex aspect-[1.91/1] w-full items-center justify-center bg-muted px-4 text-center text-caption text-muted-foreground">
                  {social.noImage}
                </div>
              )}
              <div className="flex min-w-0 flex-col gap-0.5 border-t border-border px-3 py-2">
                <span className="truncate text-caption uppercase text-muted-foreground">
                  {hostOf(storefrontOrigin)}
                </span>
                <span className="truncate text-body font-medium">{previewTitle}</span>
                <span className="line-clamp-2 text-caption text-muted-foreground">
                  {shareDescription}
                </span>
              </div>
            </div>
            {image ? (
              <p className="text-caption text-muted-foreground">{social.imageHelp}</p>
            ) : null}
          </section>
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
    </DataCard>
  )
}
