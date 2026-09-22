'use client'

import type { RichTextValue } from '@commerce/richtext'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import RichTextField from '@/components/fields/rich-text-field'
import { articleFormContent } from '@/data/blog'

type ArticleMainCardProps = {
  title: string
  body: RichTextValue | null
  excerpt: string
  onChange: (patch: { title?: string; body?: RichTextValue; excerpt?: string }) => void
}

const copy = articleFormContent.main

/** Title, the post itself and its excerpt, as the first card of Shopify's post editor. */
export default function ArticleMainCard({ title, body, excerpt, onChange }: ArticleMainCardProps) {
  // Render logic
  return (
    <Card size="form">
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="article-title">{copy.title}</FieldLabel>
            <Input
              id="article-title"
              size="lg"
              value={title}
              placeholder={copy.titlePlaceholder}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </Field>
          <RichTextField
            label={copy.content}
            value={body}
            onChange={(value) => onChange({ body: value })}
            minHeight={320}
          />
          <Field>
            <FieldLabel htmlFor="article-excerpt">{copy.excerpt}</FieldLabel>
            <Textarea
              id="article-excerpt"
              size="lg"
              rows={3}
              maxLength={500}
              value={excerpt}
              onChange={(e) => onChange({ excerpt: e.target.value })}
            />
            <FieldDescription>{copy.excerptHelp}</FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
