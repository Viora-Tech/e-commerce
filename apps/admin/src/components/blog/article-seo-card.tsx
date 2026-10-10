'use client'

import { articleExcerpt, slugify } from '@commerce/core/blog'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
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
import { articleFormContent } from '@/data/blog'
import { useCopy } from '@/hooks/use-copy'

type SeoPatch = { seoTitle?: string; seoDescription?: string; handle?: string }

type ArticleSeoCardProps = {
  title: string
  body: unknown
  excerpt: string
  seoTitle: string
  seoDescription: string
  handle: string
  blogHandle: string
  storefrontOrigin: string
  onChange: (patch: SeoPatch) => void
}

const TITLE_MAX = 70
const DESCRIPTION_MAX = 320

/** Search listing preview, with the page title, meta description and URL handle behind Edit. */
export default function ArticleSeoCard({
  title,
  body,
  excerpt,
  seoTitle,
  seoDescription,
  handle,
  blogHandle,
  storefrontOrigin,
  onChange,
}: ArticleSeoCardProps) {
  // Hooks
  const { seo: copy } = useCopy(articleFormContent)
  const [editing, setEditing] = useState(Boolean(seoTitle || seoDescription))

  // Render logic
  const previewTitle = seoTitle || title
  const previewDescription = seoDescription || articleExcerpt(excerpt, body)
  const prefix = `/blogs/${blogHandle}/`
  const url = `${storefrontOrigin}${prefix}${handle || slugify(title)}`

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
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
            <span className="truncate text-xs text-muted-foreground">{url}</span>
            <span className="text-base font-medium text-primary">{previewTitle}</span>
            <span className="text-body text-muted-foreground">{previewDescription}</span>
          </div>
        ) : (
          <p className="text-body text-muted-foreground">{copy.previewHint}</p>
        )}
        {editing ? (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="article-seo-title">{copy.title}</FieldLabel>
              <Input
                size="lg"
                id="article-seo-title"
                value={seoTitle}
                placeholder={title}
                maxLength={TITLE_MAX}
                autoComplete="off"
                onChange={(e) => onChange({ seoTitle: e.target.value })}
              />
              <FieldDescription>{copy.titleHelp(seoTitle.length)}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="article-seo-description">{copy.description}</FieldLabel>
              <Textarea
                size="lg"
                id="article-seo-description"
                rows={3}
                value={seoDescription}
                maxLength={DESCRIPTION_MAX}
                onChange={(e) => onChange({ seoDescription: e.target.value })}
              />
              <FieldDescription>{copy.descriptionHelp(seoDescription.length)}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="article-seo-handle">{copy.handle}</FieldLabel>
              <InputGroup size="lg">
                <InputGroupAddon>
                  <InputGroupText>{prefix}</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id="article-seo-handle"
                  value={handle}
                  placeholder={slugify(title)}
                  autoComplete="off"
                  onChange={(e) => onChange({ handle: e.target.value })}
                />
              </InputGroup>
            </Field>
          </FieldGroup>
        ) : null}
      </CardContent>
    </Card>
  )
}
