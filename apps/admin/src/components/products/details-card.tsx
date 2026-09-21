'use client'

import type { RichTextValue } from '@commerce/richtext'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { RichTextField } from '@/components/fields/rich-text-field'
import { productFormContent } from '@/data/products'

type DetailsCardProps = {
  title: string
  description: RichTextValue | null
  titleError?: string | undefined
  onTitle: (value: string) => void
  onDescription: (value: RichTextValue) => void
}

const copy = productFormContent.details

export function DetailsCard({
  title,
  description,
  titleError,
  onTitle,
  onDescription,
}: DetailsCardProps) {
  return (
    <Card size="form">
      <CardContent>
        <FieldGroup>
          <Field data-invalid={Boolean(titleError)}>
            <FieldLabel htmlFor="product-title">
              {copy.title}
              <span aria-hidden="true">*</span>
            </FieldLabel>
            <Input
              size="lg"
              id="product-title"
              value={title}
              onChange={(e) => onTitle(e.target.value)}
              placeholder={copy.titlePlaceholder}
              autoComplete="off"
              aria-invalid={Boolean(titleError)}
            />
            {titleError ? <FieldError>{productFormContent.errors.title}</FieldError> : null}
          </Field>
          <RichTextField
            label={copy.description}
            value={description}
            onChange={onDescription}
            placeholder={copy.descriptionPlaceholder}
            minHeight={220}
          />
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
