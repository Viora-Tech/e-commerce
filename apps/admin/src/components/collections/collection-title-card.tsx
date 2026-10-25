'use client'

import type { RichTextValue } from '@commerce/richtext'
import { Field, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import RichTextField from '@/components/fields/rich-text-field'
import DataCard from '@/components/layout/data-card'
import { collectionDetailContent, collectionFormContent } from '@/data/collections'
import { useCopy } from '@/hooks/use-copy'

type CollectionTitleCardProps = {
  title: string
  description: unknown
  onChange: (patch: { title?: string; description?: unknown }) => void
}

/** "Title and description" card of the collection detail frames. */
export default function CollectionTitleCard({
  title,
  description,
  onChange,
}: CollectionTitleCardProps) {
  // Hooks
  const detail = useCopy(collectionDetailContent)
  const { details: copy } = useCopy(collectionFormContent)

  // Render logic
  return (
    <DataCard title={detail.titleCard}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="collection-title">{copy.title}</FieldLabel>
          <Input
            id="collection-title"
            value={title}
            placeholder={copy.titlePlaceholder}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </Field>
        <RichTextField
          label={copy.description}
          value={description as RichTextValue | null}
          onChange={(value) => onChange({ description: value })}
          minHeight={140}
        />
      </FieldGroup>
    </DataCard>
  )
}
