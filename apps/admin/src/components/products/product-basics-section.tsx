'use client'

import type { RichTextValue } from '@commerce/richtext'
import { Field, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import RequiredMark from '@/components/fields/required-mark'
import RichTextField from '@/components/fields/rich-text-field'
import { productFormContent } from '@/data/product-form'
import { useCopy } from '@/hooks/use-copy'

type ProductBasicsSectionProps = {
  title: string
  description: RichTextValue | null
  titleError?: string | undefined
  onTitle: (value: string) => void
  onDescription: (value: RichTextValue) => void
}

/** Frame 5:5117 and 5:5121: product name over a 155px description well. */
export default function ProductBasicsSection({
  title,
  description,
  titleError,
  onTitle,
  onDescription,
}: ProductBasicsSectionProps) {
  // Hooks
  const formCopy = useCopy(productFormContent)
  const copy = formCopy.details

  // Render logic
  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="product-title">
          {copy.title}
          <RequiredMark />
        </FieldLabel>
        <Input
          size="kit"
          id="product-title"
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          placeholder={copy.titlePlaceholder}
          autoComplete="off"
          aria-invalid={Boolean(titleError)}
        />
        {titleError ? <FieldError>{formCopy.errors.title}</FieldError> : null}
      </Field>
      <RichTextField
        label={copy.description}
        value={description}
        onChange={onDescription}
        placeholder={copy.descriptionPlaceholder}
        minHeight={155}
        // Room between the toolbar and the first line, so the text does not hug the toolbar.
        className="[&_.editor-input]:py-5 [&_.editor-placeholder]:top-5"
      />
    </div>
  )
}
