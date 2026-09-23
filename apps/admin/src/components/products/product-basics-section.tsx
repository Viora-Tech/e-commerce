'use client'

import type { RichTextValue } from '@commerce/richtext'
import { Input } from '@commerce/ui/shadcn/input'
import RichTextField from '@/components/fields/rich-text-field'
import KitField from '@/components/kit/kit-field'
import { productFormContent } from '@/data/products'

type ProductBasicsSectionProps = {
  title: string
  description: RichTextValue | null
  titleError?: string | undefined
  onTitle: (value: string) => void
  onDescription: (value: RichTextValue) => void
}

const copy = productFormContent.details

/** Frame 5:5117 and 5:5121: product name over a 155px description well. */
export default function ProductBasicsSection({
  title,
  description,
  titleError,
  onTitle,
  onDescription,
}: ProductBasicsSectionProps) {
  // Render logic
  return (
    <div className="flex flex-col gap-4">
      <KitField
        label={copy.title}
        htmlFor="product-title"
        required
        error={titleError ? productFormContent.errors.title : undefined}
      >
        <Input
          size="kit"
          id="product-title"
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          placeholder={copy.titlePlaceholder}
          autoComplete="off"
          aria-invalid={Boolean(titleError)}
        />
      </KitField>
      <RichTextField
        label={copy.description}
        value={description}
        onChange={onDescription}
        placeholder={copy.descriptionPlaceholder}
        minHeight={155}
      />
    </div>
  )
}
