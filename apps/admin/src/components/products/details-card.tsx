'use client'

import type { RichTextValue } from '@commerce/richtext'
import { Card, FormLayout, TextField } from '@shopify/polaris'
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
    <Card>
      <FormLayout>
        <TextField
          label={copy.title}
          value={title}
          onChange={onTitle}
          placeholder={copy.titlePlaceholder}
          autoComplete="off"
          requiredIndicator
          error={titleError ? productFormContent.errors.title : undefined}
        />
        <RichTextField
          label={copy.description}
          value={description}
          onChange={onDescription}
          placeholder={copy.descriptionPlaceholder}
          minHeight={220}
        />
      </FormLayout>
    </Card>
  )
}
